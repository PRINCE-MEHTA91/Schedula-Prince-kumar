import {
  IsEnum,
  IsDateString,
  IsString,
  Matches,
  IsInt,
  IsPositive,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { SchedulingType } from '../entities/doctor-schedule.entity';

export class CreateScheduleDto {
  @IsEnum(SchedulingType, {
    message: 'schedulingType must be either STREAM or WAVE',
  })
  schedulingType: SchedulingType;

  @IsDateString({}, { message: 'date must be a valid ISO date (YYYY-MM-DD)' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be in HH:MM format (e.g. 10:00)',
  })
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime must be in HH:MM format (e.g. 11:00)',
  })
  endTime: string;

  // ─── STREAM only ─────────────────────────────────────────────────────────────

  /**
   * Duration of each appointment slot in minutes.
   * Required when schedulingType = STREAM.
   */
  @ValidateIf((o) => o.schedulingType === SchedulingType.STREAM)
  @IsInt({ message: 'slotDuration must be an integer number of minutes' })
  @IsPositive({ message: 'slotDuration must be greater than 0' })
  slotDuration?: number;

  /**
   * Gap between consecutive slots in minutes.
   * Optional for STREAM (defaults to 0).
   */
  @ValidateIf((o) => o.schedulingType === SchedulingType.STREAM)
  @IsOptional()
  @IsInt({ message: 'bufferTime must be an integer number of minutes' })
  @Min(0, { message: 'bufferTime cannot be negative' })
  bufferTime?: number;

  // ─── WAVE only ───────────────────────────────────────────────────────────────

  /**
   * Maximum number of patients allowed in this wave.
   * Required when schedulingType = WAVE.
   */
  @ValidateIf((o) => o.schedulingType === SchedulingType.WAVE)
  @IsInt({ message: 'maxCapacity must be an integer' })
  @IsPositive({ message: 'maxCapacity must be greater than 0' })
  maxCapacity?: number;
}
