import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(DoctorProfile)
    private readonly doctorRepo: Repository<DoctorProfile>,

    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,

    // Injected to auto-create notifications on appointment events
    private readonly notificationService: NotificationService,
  ) {}

  // ─── 1. Book Appointment (PATIENT only) ──────────────────────────────────────

  async bookAppointment(patientUserId: number, dto: BookAppointmentDto) {
    // Step 1: Check doctor exists
    const doctor = await this.doctorRepo.findOne({
      where: { id: dto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${dto.doctorId} not found.`);
    }

    // Step 2: Check patient profile exists
    const patient = await this.patientRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete your profile first.',
      );
    }

    // Step 3: Check appointment is for a future date and time
    // Combine date + startTime to compare with current time
    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    const now = new Date();
    if (appointmentDateTime <= now) {
      throw new BadRequestException(
        'Appointment must be scheduled for a future date and time.',
      );
    }

    // Step 4: Validate slot is within doctor's availability hours
    const parsedAvail = this.parseAvailability(doctor.availabilityHours);
    if (!parsedAvail) {
      throw new BadRequestException(
        'Doctor has no valid availability hours set.',
      );
    }

    const { startDay, endDay, startMin, endMin } = parsedAvail;
    const requestDay = appointmentDateTime.getDay(); // 0 for Sunday, 1 for Monday

    if (!this.isDayInRange(requestDay, startDay, endDay)) {
      throw new BadRequestException(
        `Doctor is not available on this day of the week.`,
      );
    }

    const [reqHour, reqMinute] = dto.startTime.split(':').map(Number);
    const [reqEndHour, reqEndMinute] = dto.endTime.split(':').map(Number);
    const reqStartMin = reqHour * 60 + reqMinute;
    const reqEndMin = reqEndHour * 60 + reqEndMinute;

    if (reqStartMin < startMin || reqEndMin > endMin) {
      throw new BadRequestException(
        `Slot ${dto.startTime}-${dto.endTime} is outside doctor's availability hours.`,
      );
    }

    let tokenNumber: number | null = null;

    if (doctor.schedulingType === 'WAVE') {
      const waveAppointments = await this.appointmentRepo.find({
        where: {
          doctorId: dto.doctorId,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: AppointmentStatus.BOOKED,
        },
      });

      const maxCapacity = doctor.maxPatientsPerWave || 5;
      if (waveAppointments.length >= maxCapacity) {
        const nextAvailable = await this.getNextAvailableSlots(dto.doctorId, dto.date);
        throw new ConflictException({
          message: 'Requested wave is full. Suggest the next available day slot',
          suggestedDate: nextAvailable.date,
          suggestedSlots: nextAvailable.slots
        });
      }
      
      tokenNumber = waveAppointments.length + 1;
    } else {
      // Step 5: Check this exact slot is not already booked (same doctor + date + startTime)
      const existing = await this.appointmentRepo.findOne({
        where: {
          doctorId: dto.doctorId,
          date: dto.date,
          startTime: dto.startTime,
          status: AppointmentStatus.BOOKED,
        },
      });
      if (existing) {
        const nextAvailable = await this.getNextAvailableSlots(dto.doctorId, dto.date);
        throw new ConflictException({
          message: 'Requested slot unavailable. Suggest the next available day slot',
          suggestedDate: nextAvailable.date,
          suggestedSlots: nextAvailable.slots
        });
      }
    }

    // All checks passed — create the appointment
    const appointment = this.appointmentRepo.create({
      doctorId: dto.doctorId,
      patientId: patient.id,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
      tokenNumber, // will be null for STREAM
    });

    const saved = await this.appointmentRepo.save(appointment);

    // ── Auto-notification: APPOINTMENT_BOOKED ───────────────────────────────
    // Format date for human-readable message e.g. "25 June"
    const bookedDateLabel = new Date(`${dto.date}T00:00:00`).toLocaleDateString(
      'en-IN',
      { day: 'numeric', month: 'long' },
    );
    await this.notificationService.createNotification(
      patient.id,
      NotificationType.APPOINTMENT_BOOKED,
      'Appointment Booked',
      `Your appointment with Dr. ${doctor.fullName} has been booked successfully for ${bookedDateLabel} at ${dto.startTime}.`,
    );

    return {
      message: 'Appointment booked successfully',
      appointment: saved,
    };
  }

  // ─── 2. Get Patient's Own Appointments ───────────────────────────────────────

  async getMyAppointments(patientUserId: number) {
    // First find the patient profile
    const patient = await this.patientRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete your profile first.',
      );
    }

    // Get all appointments for this patient with doctor info
    const appointments = await this.appointmentRepo.find({
      where: { patientId: patient.id },
      relations: { doctor: true }, // brings in DoctorProfile data
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      return {
        message: 'You have no appointments yet.',
        appointments: [],
      };
    }

    // Shape the response — only return what patient needs to see
    const result = appointments.map((appt) => ({
      id: appt.id,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      doctor: {
        id: appt.doctor.id,
        fullName: appt.doctor.fullName,
        specialization: appt.doctor.specialization,
        consultationFee: appt.doctor.consultationFee,
      },
    }));

    return {
      message: 'Appointments fetched successfully',
      appointments: result,
    };
  }

  // ─── 3. Reschedule Appointment (PATIENT only) ────────────────────────────────

  async rescheduleAppointment(
    appointmentId: number,
    patientUserId: number,
    dto: UpdateAppointmentDto,
  ) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: { doctor: true, patient: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.patient.userId !== patientUserId)
      throw new ForbiddenException('Not authorized to update this appointment');
    if (appointment.status === AppointmentStatus.CANCELLED)
      throw new BadRequestException('Cannot update a cancelled appointment');

    // Rule 1: Check cutoff time for the OLD appointment
    const oldAppointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}:00`);
    const now = new Date();
    const diffInMinutes = (oldAppointmentDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (oldAppointmentDateTime <= now) {
      throw new BadRequestException('Cannot reschedule a past appointment.');
    }
    
    if (diffInMinutes < 30) {
      throw new BadRequestException('Cannot reschedule appointment less than 30 minutes before start time.');
    }

    const newDate = dto.date || appointment.date;
    const newStartTime = dto.startTime || appointment.startTime;
    const newEndTime = dto.endTime || appointment.endTime;

    // Step 3: Check future date
    const appointmentDateTime = new Date(`${newDate}T${newStartTime}:00`);
    if (appointmentDateTime <= new Date())
      throw new BadRequestException('Must be a future date and time');

    // Step 4: Validate against doctor's availability
    const parsedAvail = this.parseAvailability(
      appointment.doctor.availabilityHours,
    );
    if (!parsedAvail)
      throw new BadRequestException(
        'Doctor has no valid availability hours set.',
      );

    const { startDay, endDay, startMin, endMin } = parsedAvail;
    const requestDateObj = new Date(`${newDate}T00:00:00`);
    const requestDay = requestDateObj.getDay();

    if (!this.isDayInRange(requestDay, startDay, endDay)) {
      throw new BadRequestException(
        'Doctor is not available on this day of the week.',
      );
    }

    const [reqHour, reqMinute] = newStartTime.split(':').map(Number);
    const [reqEndHour, reqEndMinute] = newEndTime.split(':').map(Number);
    const reqStartMin = reqHour * 60 + reqMinute;
    const reqEndMin = reqEndHour * 60 + reqEndMinute;

    if (reqStartMin < startMin || reqEndMin > endMin) {
      throw new BadRequestException(
        "Slot is outside doctor's availability hours.",
      );
    }

    // Step 5: Check overlap
    let tokenNumber: number | null = appointment.tokenNumber;

    if (appointment.doctor.schedulingType === 'WAVE') {
      const waveAppointments = await this.appointmentRepo.find({
        where: {
          doctorId: appointment.doctorId,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          status: AppointmentStatus.BOOKED,
        },
      });

      // Filter out the current appointment from the count
      const otherWaveAppts = waveAppointments.filter(a => a.id !== appointment.id);
      const maxCapacity = appointment.doctor.maxPatientsPerWave || 5;

      if (otherWaveAppts.length >= maxCapacity) {
        const nextAvailable = await this.getNextAvailableSlots(appointment.doctorId, newDate);
        throw new ConflictException({
          message: 'Requested wave is full. Suggest the next available day slot',
          suggestedDate: nextAvailable.date,
          suggestedSlots: nextAvailable.slots
        });
      }

      tokenNumber = otherWaveAppts.length + 1;
    } else {
      const existing = await this.appointmentRepo.findOne({
        where: {
          doctorId: appointment.doctorId,
          date: newDate,
          startTime: newStartTime,
          status: AppointmentStatus.BOOKED,
        },
      });

      if (existing && existing.id !== appointment.id) {
        const nextAvailable = await this.getNextAvailableSlots(appointment.doctorId, newDate);
        throw new ConflictException({
          message: 'Requested slot unavailable. Suggest the next available day slot',
          suggestedDate: nextAvailable.date,
          suggestedSlots: nextAvailable.slots
        });
      }
      
      tokenNumber = null;
    }

    appointment.date = newDate;
    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;
    appointment.tokenNumber = tokenNumber;

    const rescheduled = await this.appointmentRepo.save(appointment);

    // ── Auto-notification: APPOINTMENT_RESCHEDULED ──────────────────────────
    const rescheduledDateLabel = new Date(
      `${newDate}T00:00:00`,
    ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await this.notificationService.createNotification(
      appointment.patient.id,
      NotificationType.APPOINTMENT_RESCHEDULED,
      'Appointment Rescheduled',
      `Your appointment has been rescheduled to ${rescheduledDateLabel} at ${newStartTime}.`,
    );

    return {
      message: 'Appointment updated successfully',
      appointment: rescheduled,
    };
  }

  // ─── 4. Cancel Appointment (PATIENT only) ────────────────────────────────────

  async cancelAppointment(appointmentId: number, patientUserId: number) {
    // Find the appointment by ID
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });

    // Case 1: Appointment does not exist
    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found.`,
      );
    }

    // Find patient profile to verify ownership
    const patient = await this.patientRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    // Case 2: Patient does not own this appointment
    if (appointment.patientId !== patient.id) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment.',
      );
    }

    // Case 3: Already cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('This appointment is already cancelled.');
    }

    // Case 4: Past appointment or within 30 minutes cannot be cancelled
    const appointmentDateTime = new Date(
      `${appointment.date}T${appointment.startTime}:00`,
    );
    const now = new Date();
    const diffInMinutes = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (appointmentDateTime <= now) {
      throw new BadRequestException('Cannot cancel a past appointment.');
    }
    
    if (diffInMinutes < 30) {
      throw new BadRequestException('Cannot cancel appointment less than 30 minutes before start time.');
    }

    // All good — mark as cancelled
    appointment.status = AppointmentStatus.CANCELLED;
    const updated = await this.appointmentRepo.save(appointment);

    // ── Auto-notification: APPOINTMENT_CANCELLED ────────────────────────────
    const cancelledDateLabel = new Date(
      `${appointment.date}T00:00:00`,
    ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await this.notificationService.createNotification(
      patient.id,
      NotificationType.APPOINTMENT_CANCELLED,
      'Appointment Cancelled',
      `Your appointment scheduled on ${cancelledDateLabel} at ${appointment.startTime} has been cancelled.`,
    );

    return {
      message: 'Appointment cancelled successfully',
      appointment: updated,
    };
  }

  // ─── 5. Doctor's Appointment View (DOCTOR only) ──────────────────────────────

  async getDoctorAppointments(doctorUserId: number, dateFilter?: string) {
    // Find doctor profile by userId
    const doctor = await this.doctorRepo.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete your profile first.',
      );
    }

    // Build query to exclude cancelled appointments by default
    const whereClause: any = {
      doctorId: doctor.id,
    };
    
    // Support filtering by date
    if (dateFilter) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
      }
      whereClause.date = dateFilter;
    }

    // Get all appointments for this doctor with patient info
    let appointments = await this.appointmentRepo.find({
      where: whereClause,
      relations: { patient: true }, // brings in PatientProfile data
      order: { date: 'ASC', startTime: 'ASC' },
    });

    // Cancelled appointments should not appear in the active appointments list.
    appointments = appointments.filter(appt => appt.status !== AppointmentStatus.CANCELLED);

    if (appointments.length === 0) {
      return {
        message: 'No appointments found.',
        appointments: [],
      };
    }

    // Shape the response — only return what doctor needs to see
    const result = appointments.map((appt) => ({
      id: appt.id,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      schedulingType: 'Stream', // Defaulting to Stream as Wave scheduling is not yet fully implemented
      patient: {
        id: appt.patient.id,
        fullName: appt.patient.fullName,
        age: appt.patient.age,
        gender: appt.patient.gender,
        contactDetails: appt.patient.contactDetails,
      },
    }));

    return {
      message: 'Appointments fetched successfully',
      appointments: result,
    };
  }

  // ─── Doctor Cancels Appointment (DOCTOR only) ──────────────────────────────

  async cancelDoctorAppointment(appointmentId: number, doctorUserId: number) {
    // Find doctor profile to verify ownership
    const doctor = await this.doctorRepo.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found.');
    }

    // Find the appointment by ID and include patient relation for notification
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: { patient: true },
    });

    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found.`,
      );
    }

    // Verify ownership
    if (appointment.doctorId !== doctor.id) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment.',
      );
    }

    // Check if already cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('This appointment is already cancelled.');
    }

    // Cancel appointment
    appointment.status = AppointmentStatus.CANCELLED;
    const updated = await this.appointmentRepo.save(appointment);

    // Auto-notification: APPOINTMENT_CANCELLED
    const cancelledDateLabel = new Date(
      `${appointment.date}T00:00:00`,
    ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await this.notificationService.createNotification(
      appointment.patient.id,
      NotificationType.APPOINTMENT_CANCELLED,
      'Appointment Cancelled',
      `Your appointment scheduled on ${cancelledDateLabel} at ${appointment.startTime} has been cancelled by Dr. ${doctor.fullName}.`,
    );

    return {
      message: 'Appointment cancelled successfully',
      appointment: updated,
    };
  }

  // ─── 6. Get Available Slots ──────────────────────────────────────────────────

  async getAvailableSlots(doctorId: number, date: string) {
    // 1. Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    // 2. Check if doctor exists
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);
    }

    if (!doctor.isAvailable) {
      return {
        message: 'Doctor is currently not available for new appointments.',
        slots: [],
      };
    }

    // 3. Extract and validate availability hours
    const parsedAvail = this.parseAvailability(doctor.availabilityHours);
    if (!parsedAvail) {
      return {
        message: 'Doctor has no valid availability hours set.',
        slots: [],
      };
    }

    const { startDay, endDay, startMin, endMin } = parsedAvail;

    // We add T00:00:00 to avoid timezone shifts affecting the local day
    const requestDateObj = new Date(`${date}T00:00:00`);
    const requestDay = requestDateObj.getDay();

    if (!this.isDayInRange(requestDay, startDay, endDay)) {
      return {
        message: 'Doctor is not available on this day of the week.',
        slots: [],
      };
    }

    // 4. Fetch already booked appointments for this doctor on this date
    const bookedAppointments = await this.appointmentRepo.find({
      where: {
        doctorId,
        date,
        status: AppointmentStatus.BOOKED,
      },
      select: { startTime: true, endTime: true },
    });

    // Extract booked start times for easy lookup
    // Using doctor's slotDuration and bufferTime for STREAM
    const slots: any[] = [];

    if (doctor.schedulingType === 'WAVE') {
      const maxCapacity = doctor.maxPatientsPerWave || 5;
      const bookedCount = bookedAppointments.length;
      
      const slotStartHour = String(Math.floor(startMin / 60)).padStart(2, '0');
      const slotStartMin = String(startMin % 60).padStart(2, '0');
      const waveStartTime = `${slotStartHour}:${slotStartMin}`;

      const slotEndHour = String(Math.floor(endMin / 60)).padStart(2, '0');
      const slotEndMin = String(endMin % 60).padStart(2, '0');
      const waveEndTime = `${slotEndHour}:${slotEndMin}`;

      if (bookedCount < maxCapacity) {
        slots.push({
          startTime: waveStartTime,
          endTime: waveEndTime,
          available: maxCapacity - bookedCount,
          max: maxCapacity,
        });
      }
    } else {
      // STREAM
      const slotDurationMinutes = doctor.slotDuration || 15;
      const bufferTimeMinutes = doctor.bufferTime || 0;
      let currentMin = startMin;

      while (currentMin + slotDurationMinutes <= endMin) {
        const slotStartHour = String(Math.floor(currentMin / 60)).padStart(2, '0');
        const slotStartMin = String(currentMin % 60).padStart(2, '0');
        const startTime = `${slotStartHour}:${slotStartMin}`;

        const nextMin = currentMin + slotDurationMinutes;
        const slotEndHour = String(Math.floor(nextMin / 60)).padStart(2, '0');
        const slotEndMin = String(nextMin % 60).padStart(2, '0');
        const endTime = `${slotEndHour}:${slotEndMin}`;

        // Check if this slot overlaps with any booked appointment
        const isBooked = bookedAppointments.some((appt) => {
          return startTime < appt.endTime && endTime > appt.startTime;
        });

        if (!isBooked) {
          slots.push({ startTime, endTime });
        }

        currentMin = nextMin + bufferTimeMinutes;
      }
    }

    return {
      message: 'Available slots fetched successfully',
      date,
      slots,
    };
  }

  // ─── 7. Next Available Appointment Booking ───────────────────────────────────

  async getNextAvailableSlots(doctorId: number, startDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);
    }

    if (!doctor.isAvailable) {
      return {
        message: 'Doctor is currently not available for new appointments.',
        slots: [],
      };
    }

    const parsedAvail = this.parseAvailability(doctor.availabilityHours);
    if (!parsedAvail) {
      return {
        message: 'Doctor has no valid availability hours set.',
        slots: [],
      };
    }

    const maxDaysToSearch = 30;
    const currentDate = new Date(`${startDate}T00:00:00`);

    for (let i = 0; i < maxDaysToSearch; i++) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const currentDay = currentDate.getDay();

      // Only check if it's a working day
      if (this.isDayInRange(currentDay, parsedAvail.startDay, parsedAvail.endDay)) {
        const slotsResult = await this.getAvailableSlots(doctorId, dateStr);

        if (slotsResult.slots && slotsResult.slots.length > 0) {
          return {
            message:
              i === 0
                ? 'Slots available today'
                : 'Next available slots fetched successfully',
            date: dateStr,
            slots: slotsResult.slots,
          };
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      message:
        'No appointments available in the next 30 working days. Please try again later.',
      date: null,
      slots: [],
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseAvailability(availabilityStr: string) {
    // Expected format: "Mon-Sat 10am-4pm" or "Mon-Fri 09:00am-05:00pm"
    // Regex matches: 1=startDay, 2=endDay, 3=startTime, 4=endTime
    const regex =
      /([A-Za-z]+)-([A-Za-z]+)\s+(\d{1,2}(?::\d{2})?(?:am|pm|AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?(?:am|pm|AM|PM))/;
    const match = availabilityStr.match(regex);

    if (!match) return null;

    const dayMap: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };

    const startDay = dayMap[match[1].toLowerCase().slice(0, 3)];
    const endDay = dayMap[match[2].toLowerCase().slice(0, 3)];

    if (startDay === undefined || endDay === undefined) return null;

    const parseTime = (timeStr: string) => {
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?(am|pm|AM|PM)/i);
      if (!timeMatch) return null;
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2] || '0', 10);
      const ampm = timeMatch[3].toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    const startMin = parseTime(match[3]);
    const endMin = parseTime(match[4]);

    if (startMin === null || endMin === null) return null;

    return { startDay, endDay, startMin, endMin };
  }

  private isDayInRange(day: number, startDay: number, endDay: number): boolean {
    if (startDay <= endDay) {
      return day >= startDay && day <= endDay;
    } else {
      // Handles wrapping around the week, e.g., "Sat-Sun" (6 to 0)
      return day >= startDay || day <= endDay;
    }
  }
}
