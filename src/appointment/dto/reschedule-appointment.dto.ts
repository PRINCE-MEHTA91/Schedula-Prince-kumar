import { IsInt, IsOptional, IsPositive } from 'class-validator';

/**
 * DTO for rescheduling an existing appointment.
 * Provide EITHER newStreamSlotId (for STREAM) OR newWaveScheduleId (for WAVE).
 * The scheduling type of the appointment cannot be changed during reschedule.
 */
export class RescheduleAppointmentDto {
  /**
   * New stream slot ID — required for STREAM appointments.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  newStreamSlotId?: number;

  /**
   * New wave schedule ID — required for WAVE appointments.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  newWaveScheduleId?: number;
}
