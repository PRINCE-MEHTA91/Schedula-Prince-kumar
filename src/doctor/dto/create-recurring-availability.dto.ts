import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export enum DayOfWeek {
  SUNDAY = 'SUNDAY',
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}

export class CreateRecurringAvailabilityDto {
  @IsEnum(DayOfWeek, { message: 'dayOfWeek must be a valid day (e.g. MONDAY)' })
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;
}
