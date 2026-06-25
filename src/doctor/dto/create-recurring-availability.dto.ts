import { IsEnum, IsString, Matches, IsNotEmpty } from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';

export class CreateRecurringAvailabilityDto {
  @IsEnum(DayOfWeek, {
    message: 'dayOfWeek must be a valid enum value (e.g., MONDAY, TUESDAY)',
  })
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):?([0-5]\d)$/, {
    message: 'startTime must be a valid time in HH:mm format',
  })
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):?([0-5]\d)$/, {
    message: 'endTime must be a valid time in HH:mm format',
  })
  @IsNotEmpty()
  endTime: string;
}
