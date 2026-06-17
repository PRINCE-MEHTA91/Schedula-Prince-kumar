import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export enum ScheduleCreationType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

/**
 * Unified DTO for creating either a STREAM or WAVE schedule.
 *
 * STREAM body example:
 * {
 *   "schedulingType": "STREAM",
 *   "date": "2026-07-01",
 *   "startTime": "10:00",
 *   "endTime": "11:00",
 *   "slotDuration": 15,
 *   "bufferTime": 5
 * }
 *
 * WAVE body example:
 * {
 *   "schedulingType": "WAVE",
 *   "date": "2026-07-01",
 *   "startTime": "10:00",
 *   "endTime": "11:00",
 *   "maxCapacity": 5
 * }
 */
export class CreateScheduleDto {
  @IsEnum(ScheduleCreationType, {
    message: 'schedulingType must be STREAM or WAVE',
  })
  schedulingType: ScheduleCreationType;

  /** Date in ISO format: YYYY-MM-DD */
  @IsDateString()
  @IsNotEmpty()
  date: string;

  /** Start time in HH:MM (24-hour) format. Example: "10:00" */
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  @IsNotEmpty()
  startTime: string;

  /** End time in HH:MM (24-hour) format. Example: "11:00" */
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:MM format' })
  @IsNotEmpty()
  endTime: string;

  // ── STREAM-only fields ────────────────────────────────────────────────────

  /**
   * [STREAM only] Duration of each slot in minutes.
   * System auto-generates slots within the window.
   * Example: 15 → each slot is 15 minutes long
   */
  @ValidateIf((o) => o.schedulingType === ScheduleCreationType.STREAM)
  @IsInt()
  @Min(5, { message: 'slotDuration must be at least 5 minutes' })
  @IsNotEmpty()
  slotDuration?: number;

  /**
   * [STREAM only] Buffer (gap) between consecutive slots in minutes.
   * Optional — defaults to 0 (back-to-back slots).
   * Example: 5 → 5-minute gap between each slot
   */
  @ValidateIf((o) => o.schedulingType === ScheduleCreationType.STREAM)
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'bufferTime cannot be negative' })
  bufferTime?: number;

  // ── WAVE-only fields ──────────────────────────────────────────────────────

  /**
   * [WAVE only] Maximum number of patients for this wave.
   * Must be at least 1.
   */
  @ValidateIf((o) => o.schedulingType === ScheduleCreationType.WAVE)
  @IsInt()
  @Min(1, { message: 'maxCapacity must be at least 1' })
  @IsNotEmpty()
  maxCapacity?: number;
}
