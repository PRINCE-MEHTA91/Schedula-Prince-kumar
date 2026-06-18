import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class BookAppointmentDto {
  /**
   * ID of the doctor_schedule to book into.
   */
  @IsInt()
  @IsPositive()
  scheduleId: number;

  /**
   * ID of the specific appointment_slot to book.
   * Required only for STREAM scheduling.
   * Not needed for WAVE (token is auto-assigned).
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  slotId?: number;
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class BookAppointmentDto {
  // The doctor's profile ID (from GET /doctor)
  @IsNotEmpty({ message: 'doctorId is required' })
  doctorId: number;

  // Date in YYYY-MM-DD format e.g. "2026-06-20"
  @IsString()
  @IsNotEmpty({ message: 'date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format e.g. 2026-06-20',
  })
  date: string;

  // Start time in HH:mm format e.g. "10:00"
  @IsString()
  @IsNotEmpty({ message: 'startTime is required' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be in HH:mm format e.g. 10:00',
  })
  startTime: string;

  // End time in HH:mm format e.g. "10:15"
  @IsString()
  @IsNotEmpty({ message: 'endTime is required' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime must be in HH:mm format e.g. 10:15',
  })
  endTime: string;
}
