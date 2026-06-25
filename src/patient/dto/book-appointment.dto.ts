import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Matches,
} from 'class-validator';

export class BookAppointmentDto {
  @IsInt()
  @IsPositive()
  doctorId: number;

  @IsNotEmpty()
  @IsDateString({}, { message: 'date must be a valid date (e.g. 2026-06-20)' })
  date: string;

  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (e.g. 10:00)',
  })
  startTime: string;
}
