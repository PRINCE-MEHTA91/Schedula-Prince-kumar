import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCustomAvailabilityDto {
  @IsDateString({}, { message: 'date must be a valid ISO8601 string (e.g. 2026-06-20)' })
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
