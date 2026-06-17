import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Matches,
  Min,
} from 'class-validator';

/**
 * DTO for a doctor to create a wave scheduling window.
 */
export class CreateWaveScheduleDto {
  /**
   * Date in ISO format: YYYY-MM-DD
   * Example: "2025-06-20"
   */
  @IsDateString()
  @IsNotEmpty()
  date: string;

  /**
   * Wave start time in HH:MM (24-hour) format.
   * Example: "14:00"
   */
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  @IsNotEmpty()
  startTime: string;

  /**
   * Wave end time in HH:MM (24-hour) format.
   * Example: "15:00"
   */
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:MM format' })
  @IsNotEmpty()
  endTime: string;

  /**
   * Maximum number of patients allowed in this wave.
   * Must be at least 1.
   */
  @IsInt()
  @Min(1)
  capacity: number;
}
