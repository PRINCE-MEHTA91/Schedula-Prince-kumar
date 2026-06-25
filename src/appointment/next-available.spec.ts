/**
 * Unit tests for AppointmentService.findNextAvailable()
 *
 * Scenarios covered:
 *  1. Slots available today (Stream scheduling)
 *  2. Slots available today (Wave scheduling)
 *  3. Today fully booked → next day available (Stream)
 *  4. Multiple consecutive full days → eventual open day
 *  5. No slots within 30 days → limit message
 *  6. Doctor unavailable (isAvailable = false)
 *  7. Doctor not found (invalid ID)
 *  8. Doctor's day-off → skip to next working day
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { DayOfWeek } from '../doctor/enums/day-of-week.enum';

// ─── Shared mock factory ────────────────────────────────────────────────────
const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// ─── Helper to get today's YYYY-MM-DD ─────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Helper to get the day-of-week string for a given date offset ───────────
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayOfWeekForOffset(offset: number): DayOfWeek {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return DAY_NAMES[d.getDay()] as DayOfWeek;
}

// ─── Base doctor profile ────────────────────────────────────────────────────
const baseDoctor: Partial<DoctorProfile> = {
  id: 1,
  fullName: 'Dr. Test',
  availabilityHours: 'Mon-Sat 09:00am-05:00pm',
  isAvailable: true,
  slotDuration: 30,
};

describe('AppointmentService.findNextAvailable()', () => {
  let service: AppointmentService;
  let doctorRepo: ReturnType<typeof mockRepo>;
  let streamSlotRepo: ReturnType<typeof mockRepo>;
  let waveScheduleRepo: ReturnType<typeof mockRepo>;
  let recurringAvailRepo: ReturnType<typeof mockRepo>;
  let customAvailRepo: ReturnType<typeof mockRepo>;
  let appointmentRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useFactory: mockRepo },
        { provide: getRepositoryToken(DoctorProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(PatientProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(StreamSlot), useFactory: mockRepo },
        { provide: getRepositoryToken(WaveSchedule), useFactory: mockRepo },
        { provide: getRepositoryToken(RecurringAvailability), useFactory: mockRepo },
        { provide: getRepositoryToken(CustomAvailability), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    doctorRepo = module.get(getRepositoryToken(DoctorProfile));
    streamSlotRepo = module.get(getRepositoryToken(StreamSlot));
    waveScheduleRepo = module.get(getRepositoryToken(WaveSchedule));
    recurringAvailRepo = module.get(getRepositoryToken(RecurringAvailability));
    customAvailRepo = module.get(getRepositoryToken(CustomAvailability));
    appointmentRepo = module.get(getRepositoryToken(Appointment));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Scenario 1: Stream slots available today ──────────────────────────
  it('Scenario 1 — returns today with STREAM slots when available today', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    // No custom overrides
    customAvailRepo.find.mockResolvedValue([]);
    // Recurring available today
    recurringAvailRepo.find.mockResolvedValue([
      { doctorProfileId: 1, dayOfWeek: dayOfWeekForOffset(0), startTime: '09:00', endTime: '17:00' },
    ]);
    // Two free stream slots
    streamSlotRepo.find.mockResolvedValue([
      { id: 10, doctorId: 1, date: todayStr(), startTime: '09:00', endTime: '09:30', isAvailable: true, isBooked: false },
      { id: 11, doctorId: 1, date: todayStr(), startTime: '09:30', endTime: '10:00', isAvailable: true, isBooked: false },
    ]);
    waveScheduleRepo.find.mockResolvedValue([]);
    appointmentRepo.find.mockResolvedValue([]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBe(todayStr());
    expect(result.schedulingType).toBe('STREAM');
    expect(result.availableSlots).toHaveLength(2);
    expect(result.availableWaves).toHaveLength(0);
    expect(result.message).toContain('Next available appointment found');
  });

  // ─── Scenario 2: Wave schedule available today ─────────────────────────
  it('Scenario 2 — returns today with WAVE when wave has remaining capacity', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    customAvailRepo.find.mockResolvedValue([]);
    recurringAvailRepo.find.mockResolvedValue([
      { doctorProfileId: 1, dayOfWeek: dayOfWeekForOffset(0), startTime: '09:00', endTime: '17:00' },
    ]);
    // No stream slots
    streamSlotRepo.find.mockResolvedValue([]);
    // Wave with remaining capacity
    waveScheduleRepo.find.mockResolvedValue([
      { id: 5, doctorId: 1, date: todayStr(), startTime: '14:00', endTime: '15:00', capacity: 10, bookedCount: 6 },
    ]);
    appointmentRepo.find.mockResolvedValue([]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBe(todayStr());
    expect(result.schedulingType).toBe('WAVE');
    expect(result.availableWaves).toHaveLength(1);
    expect(result.availableWaves[0].remaining).toBe(4);
  });

  // ─── Scenario 3: Today fully booked → next day available (Stream) ──────
  it('Scenario 3 — skips today (fully booked) and returns next day', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });

    // customAvailRepo always returns []
    customAvailRepo.find.mockResolvedValue([]);

    // recurringAvailRepo returns slots for both today and tomorrow
    recurringAvailRepo.find.mockResolvedValue([
      { doctorProfileId: 1, startTime: '09:00', endTime: '17:00' },
    ]);

    // Today: NO free stream slots (all booked)
    // Tomorrow: 1 free stream slot
    streamSlotRepo.find
      .mockResolvedValueOnce([]) // today
      .mockResolvedValueOnce([  // tomorrow
        { id: 20, doctorId: 1, date: tomorrowStr, startTime: '09:00', endTime: '09:30', isAvailable: true, isBooked: false },
      ]);

    // No waves
    waveScheduleRepo.find.mockResolvedValue([]);

    // Today all appointments are booked → legacy fallback also has no free slots
    // Simulate all legacy slots booked today
    appointmentRepo.find.mockResolvedValueOnce([
      { startTime: '09:00', endTime: '17:00' }, // block entire day
    ]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBe(tomorrowStr);
    expect(result.schedulingType).toBe('STREAM');
    expect(result.availableSlots).toHaveLength(1);
  });

  // ─── Scenario 4: Multiple consecutive full days ─────────────────────────
  it('Scenario 4 — skips multiple full days and finds slot on day 3', async () => {
    const day3 = new Date();
    day3.setDate(day3.getDate() + 3);
    const day3Str = `${day3.getFullYear()}-${String(day3.getMonth() + 1).padStart(2, '0')}-${String(day3.getDate()).padStart(2, '0')}`;

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    customAvailRepo.find.mockResolvedValue([]);
    recurringAvailRepo.find.mockResolvedValue([
      { doctorProfileId: 1, startTime: '09:00', endTime: '17:00' },
    ]);

    // Days 0,1,2 → no stream slots, day 3 → has free slot
    streamSlotRepo.find
      .mockResolvedValueOnce([]) // day 0 (today)
      .mockResolvedValueOnce([]) // day 1
      .mockResolvedValueOnce([]) // day 2
      .mockResolvedValueOnce([  // day 3
        { id: 30, doctorId: 1, date: day3Str, startTime: '10:00', endTime: '10:30', isAvailable: true, isBooked: false },
      ]);

    waveScheduleRepo.find.mockResolvedValue([]);
    // All appointments block legacy slots on days 0-2
    appointmentRepo.find.mockResolvedValue([
      { startTime: '09:00', endTime: '17:00' },
    ]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBe(day3Str);
    expect(result.schedulingType).toBe('STREAM');
  });

  // ─── Scenario 5: No slots within 30 days ───────────────────────────────
  it('Scenario 5 — returns 30-day limit message when nothing found', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    // No custom overrides
    customAvailRepo.find.mockResolvedValue([]);
    // Recurring always returns a slot (doctor works every day)
    recurringAvailRepo.find.mockResolvedValue([
      { doctorProfileId: 1, startTime: '09:00', endTime: '17:00' },
    ]);
    // No stream slots, no waves, all legacy slots booked
    streamSlotRepo.find.mockResolvedValue([]);
    waveScheduleRepo.find.mockResolvedValue([]);
    // All appointments fully block every day
    appointmentRepo.find.mockResolvedValue([
      { startTime: '09:00', endTime: '17:00' },
    ]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBeNull();
    expect(result.schedulingType).toBeNull();
    expect(result.message).toContain('No appointments available in the next 30 working days');
  });

  // ─── Scenario 6: Doctor isAvailable = false ─────────────────────────────
  it('Scenario 6 — returns not-accepting message when doctor is unavailable', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor, isAvailable: false });

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBeNull();
    expect(result.message).toContain('not accepting appointments');
    // No repo queries should have been made for slots/waves
    expect(streamSlotRepo.find).not.toHaveBeenCalled();
    expect(waveScheduleRepo.find).not.toHaveBeenCalled();
  });

  // ─── Scenario 7: Doctor not found ──────────────────────────────────────
  it('Scenario 7 — throws NotFoundException for invalid doctor ID', async () => {
    doctorRepo.findOne.mockResolvedValue(null);

    await expect(service.findNextAvailable(9999)).rejects.toThrow(NotFoundException);
  });

  // ─── Scenario 7b: Invalid (non-positive) doctor ID ─────────────────────
  it('Scenario 7b — throws BadRequestException for non-positive doctorId', async () => {
    await expect(service.findNextAvailable(-1)).rejects.toThrow(BadRequestException);
    await expect(service.findNextAvailable(0)).rejects.toThrow(BadRequestException);
  });

  // ─── Scenario 8: Day-off skip → next working day ───────────────────────
  it('Scenario 8 — skips doctor day-off and finds next working day', async () => {
    const nextWorkingDate = new Date();
    nextWorkingDate.setDate(nextWorkingDate.getDate() + 1);
    const nextWorkingDateStr = `${nextWorkingDate.getFullYear()}-${String(nextWorkingDate.getMonth() + 1).padStart(2, '0')}-${String(nextWorkingDate.getDate()).padStart(2, '0')}`;

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    customAvailRepo.find.mockResolvedValue([]);

    // Today: no recurring schedule (day off)
    // Tomorrow: has recurring schedule
    recurringAvailRepo.find
      .mockResolvedValueOnce([]) // day 0 → day off
      .mockResolvedValueOnce([  // day 1 → working
        { doctorProfileId: 1, startTime: '09:00', endTime: '17:00' },
      ]);

    streamSlotRepo.find.mockResolvedValueOnce([
      { id: 40, doctorId: 1, date: nextWorkingDateStr, startTime: '09:00', endTime: '09:30', isAvailable: true, isBooked: false },
    ]);
    waveScheduleRepo.find.mockResolvedValue([]);
    appointmentRepo.find.mockResolvedValue([]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBe(nextWorkingDateStr);
    expect(result.schedulingType).toBe('STREAM');
  });

  // ─── Scenario 9: Doctor on leave (CustomAvailability isAvailable=false) ─
  it('Scenario 9 — skips day when CustomAvailability marks doctor on leave', async () => {
    const day1 = new Date();
    day1.setDate(day1.getDate() + 1);
    const day1Str = `${day1.getFullYear()}-${String(day1.getMonth() + 1).padStart(2, '0')}-${String(day1.getDate()).padStart(2, '0')}`;

    const day2 = new Date();
    day2.setDate(day2.getDate() + 2);
    const day2Str = `${day2.getFullYear()}-${String(day2.getMonth() + 1).padStart(2, '0')}-${String(day2.getDate()).padStart(2, '0')}`;

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });

    // customAvailRepo call order:
    //   call 1 → day 0: no overrides → recurringForDay also empty → skip (day off)
    //   call 2 → day 1: on leave override → skip
    //   call 3 → day 2: no overrides → recurringForDay has slot → proceed
    customAvailRepo.find
      .mockResolvedValueOnce([])                       // day 0 — no custom
      .mockResolvedValueOnce([{ isAvailable: false }]) // day 1 — on leave
      .mockResolvedValueOnce([]);                      // day 2 — no custom

    // recurringAvailRepo call order:
    //   call 1 → day 0: no recurring (day off) → skip
    //   call 2 → day 1: skipped entirely (customAvail says on leave, never reaches here)
    //   call 3 → day 2: has recurring
    recurringAvailRepo.find
      .mockResolvedValueOnce([])  // day 0 → day off
      .mockResolvedValueOnce([{ doctorProfileId: 1, startTime: '09:00', endTime: '17:00' }]); // day 2

    streamSlotRepo.find.mockResolvedValueOnce([
      { id: 50, doctorId: 1, date: day2Str, startTime: '09:00', endTime: '09:30', isAvailable: true, isBooked: false },
    ]);
    waveScheduleRepo.find.mockResolvedValue([]);
    appointmentRepo.find.mockResolvedValue([]);

    const result = await service.findNextAvailable(1);

    expect(result.nextAvailableDate).toBe(day2Str);
  });

  // ─── Scenario 10: Wave fully booked → should not be returned ──────────
  it('Scenario 10 — skips Wave when fully booked (bookedCount >= capacity)', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    customAvailRepo.find.mockResolvedValue([]);
    recurringAvailRepo.find.mockResolvedValue([
      { doctorProfileId: 1, startTime: '09:00', endTime: '17:00' },
    ]);
    streamSlotRepo.find.mockResolvedValue([]); // no stream slots

    // Wave is full
    waveScheduleRepo.find.mockResolvedValue([
      { id: 7, doctorId: 1, date: todayStr(), startTime: '14:00', endTime: '15:00', capacity: 5, bookedCount: 5 },
    ]);

    // Legacy slots also booked
    appointmentRepo.find.mockResolvedValue([
      { startTime: '09:00', endTime: '17:00' },
    ]);

    const result = await service.findNextAvailable(1);

    // Wave is full so that day should be skipped and eventually hits 30-day limit
    expect(result.availableWaves).toHaveLength(0);
  });
});
