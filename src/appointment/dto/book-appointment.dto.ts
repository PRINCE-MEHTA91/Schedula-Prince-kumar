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
}
