import { IsOptional, IsDateString } from 'class-validator';

export class GetDoctorAppointmentsQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'date must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)' })
  date?: string;
}
