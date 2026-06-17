import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

/**
 * DTO for a doctor to create stream slots from a time window.
 *
 * The system auto-generates individual slots using:
 *   slotDuration (minutes) + bufferTime (minutes) spacing.
 *
 * Example:
 *   date: "2026-07-01", startTime: "10:00", endTime: "11:00"
 *   slotDuration: 15, bufferTime: 5
 *
 *   → Slot 1: 10:00 – 10:15
 *   → Slot 2: 10:20 – 10:35
 *   → Slot 3: 10:40 – 10:55
 *   (next would start at 11:00 and end at 11:15 — exceeds endTime, so skipped)
 */
export class CreateStreamSlotDto {
  /**
   * Date in ISO format: YYYY-MM-DD
   * Example: "2026-07-01"
   */
  @IsDateString()
  @IsNotEmpty()
  date: string;

  /**
   * Session window start time in HH:MM (24-hour) format.
   * Example: "10:00"
   */
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  @IsNotEmpty()
  startTime: string;

  /**
   * Session window end time in HH:MM (24-hour) format.
   * No slot will be created that ends after this time.
   * Example: "11:00"
   */
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:MM format' })
  @IsNotEmpty()
  endTime: string;

  /**
   * Duration of each slot in minutes.
   * Example: 15  → each slot lasts 15 minutes
   */
  @IsInt()
  @Min(5, { message: 'slotDuration must be at least 5 minutes' })
  slotDuration: number;

  /**
   * Buffer time between slots in minutes (optional, default: 0).
   * Example: 5 → 5-minute gap between consecutive slots
   */
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'bufferTime cannot be negative' })
  bufferTime?: number;
}
