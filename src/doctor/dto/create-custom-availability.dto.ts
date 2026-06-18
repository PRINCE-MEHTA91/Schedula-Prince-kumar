import { IsString, Matches, IsNotEmpty, IsBoolean, IsOptional, ValidateIf } from 'class-validator';

export class CreateCustomAvailabilityDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be a valid date in YYYY-MM-DD format',
  })
  @IsNotEmpty()
  date: string;

  @ValidateIf((o) => o.isAvailable !== false)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):?([0-5]\d)$/, {
    message: 'startTime must be a valid time in HH:mm format',
  })
  @IsNotEmpty()
  startTime?: string;

  @ValidateIf((o) => o.isAvailable !== false)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):?([0-5]\d)$/, {
    message: 'endTime must be a valid time in HH:mm format',
  })
  @IsNotEmpty()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
