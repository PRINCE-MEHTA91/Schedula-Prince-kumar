import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetAvailabilityDto {
  @IsDateString({}, { message: 'date must be a valid date in YYYY-MM-DD format' })
  @IsNotEmpty()
  date: string;
}
