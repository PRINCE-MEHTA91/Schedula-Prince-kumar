import { IsInt, IsPositive, IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for booking the next available appointment slot.
 * Used as the request body for POST /appointment/book-next-available
 *
 * Business flow:
 *  1. Patient calls GET /appointment/next-available?doctorId=X
 *  2. System returns nextAvailableDate + available slots / waves
 *  3. Patient picks a slot and sends this DTO to confirm booking
 */
export class BookNextAvailableDto {
  /** Doctor's profile ID */
  @Type(() => Number)
  @IsInt({ message: 'doctorId must be an integer' })
  @IsPositive({ message: 'doctorId must be a positive number' })
  doctorId: number;

  /**
   * The date returned by findNextAvailable — patients must use
   * the exact date provided by the system (YYYY-MM-DD).
   */
  @IsString()
  @IsNotEmpty({ message: 'date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format e.g. 2026-06-24',
  })
  date: string;

  /**
   * Start time of the chosen slot (HH:mm).
   * For Stream scheduling: pick one of the availableSlots startTime values.
   * For Wave scheduling: pick one of the availableWaves startTime values.
   */
  @IsString()
  @IsNotEmpty({ message: 'startTime is required' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be in HH:mm format e.g. 09:00',
  })
  startTime: string;

  /**
   * End time of the chosen slot (HH:mm).
   * Must match the slot/wave end time returned by findNextAvailable.
   */
  @IsString()
  @IsNotEmpty({ message: 'endTime is required' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime must be in HH:mm format e.g. 09:30',
  })
  endTime: string;

  /**
   * Optional: Wave schedule ID (only required when booking a Wave slot).
   * Ignored for Stream scheduling.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'waveId must be an integer' })
  @IsPositive({ message: 'waveId must be a positive number' })
  waveId?: number;
}
