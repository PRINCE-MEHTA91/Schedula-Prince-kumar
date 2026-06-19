import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from '../appointment/entities/appointment.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { BookAppointmentDto } from './dto/book-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,

    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,

    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,
  ) {}

  // ── Book Appointment ────────────────────────────────────────────────────────
  async bookAppointment(userId: number, dto: BookAppointmentDto) {
    // 1. Patient must have a profile
    const patient = await this.patientProfileRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found. Please create your profile first.');
    }

    // 2. Doctor must exist
    const doctor = await this.doctorProfileRepo.findOne({ where: { id: dto.doctorId } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${dto.doctorId} not found.`);
    }

    // 3. Cannot book past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(dto.date);
    bookingDate.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      throw new BadRequestException('Cannot book appointments for past dates.');
    }

    // 4. Validate the requested slot actually exists in availability
    const startTime = dto.startTime + ':00'; // e.g. "10:00" → "10:00:00"
    const slotDuration = doctor.slotDuration || 15;
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, startH, startM + slotDuration);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

    // Resolve availability for the date
    const customAvailabilities = await this.customRepo.find({
      where: { doctorProfileId: dto.doctorId, date: dto.date },
    });

    let isValidSlot = false;

    if (customAvailabilities.length > 0) {
      // Use custom availability
      const available = customAvailabilities.filter(
        (c) => c.isAvailable && c.startTime && c.endTime,
      );
      isValidSlot = available.some(
        (c) => dto.startTime + ':00' >= (c.startTime as string) && endTime <= (c.endTime as string),
      );
    } else {
      // Use recurring availability
      const dayOfWeek = bookingDate.getDay();
      const recurring = await this.recurringRepo.find({
        where: { doctorProfileId: dto.doctorId, dayOfWeek: dayOfWeek as any },
      });
      isValidSlot = recurring.some(
        (r) => dto.startTime + ':00' >= r.startTime && endTime <= r.endTime,
      );
    }

    if (!isValidSlot) {
      throw new BadRequestException(
        `The slot ${dto.startTime} is not within the doctor's availability for ${dto.date}.`,
      );
    }

    // 5. Check slot is not already booked
    const conflict = await this.appointmentRepo.findOne({
      where: {
        doctorId: dto.doctorId,
        date: dto.date,
        startTime,
        status: AppointmentStatus.CONFIRMED,
      },
    });
    if (conflict) {
      throw new ConflictException(
        `The slot ${dto.startTime} on ${dto.date} is already booked.`,
      );
    }

    // 6. Cannot book a past slot on today
    const now = new Date();
    const slotDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    if (slotDateTime <= now) {
      throw new BadRequestException('Cannot book a slot that has already passed.');
    }

    // 7. Create appointment
    const appointment = new Appointment();
    appointment.doctorId  = dto.doctorId;
    appointment.patientId = patient.id;
    appointment.date      = dto.date;
    appointment.startTime = startTime;
    appointment.endTime   = endTime;
    appointment.status    = AppointmentStatus.CONFIRMED;

    const saved = await this.appointmentRepo.save(appointment);

    return {
      message: 'Appointment booked successfully',
      appointment: {
        id        : saved.id,
        doctorId  : saved.doctorId,
        patientId : saved.patientId,
        date      : saved.date,
        startTime : saved.startTime.substring(0, 5),
        endTime   : saved.endTime.substring(0, 5),
        status    : saved.status,
      },
    };
  }

  // ── Cancel Appointment ──────────────────────────────────────────────────────
  async cancelAppointment(userId: number, appointmentId: number) {
    const patient = await this.patientProfileRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} not found.`);
    }

    // Only the patient who booked can cancel
    if (appointment.patientId !== patient.id) {
      throw new ForbiddenException('You can only cancel your own appointments.');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Appointment is already cancelled.');
    }

    if ((appointment.status as string) === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed appointment.');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    return { message: 'Appointment cancelled successfully', appointmentId };
  }

  // ── My Appointments ─────────────────────────────────────────────────────────
  async getMyAppointments(userId: number) {
    const patient = await this.patientProfileRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    const appointments = await this.appointmentRepo.find({
      where: { patientId: patient.id },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      return { message: 'No appointments found.', appointments: [] };
    }

    return {
      message: 'Appointments fetched successfully',
      appointments: appointments.map((a) => ({
        id        : a.id,
        doctorId  : a.doctorId,
        date      : a.date,
        startTime : a.startTime.substring(0, 5),
        endTime   : a.endTime.substring(0, 5),
        status    : a.status,
      })),
    };
  }
}
