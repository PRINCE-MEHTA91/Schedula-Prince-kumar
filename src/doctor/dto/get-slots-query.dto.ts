import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetSlotsQueryDto {
  @IsNotEmpty({ message: 'Date is required' })
  @IsDateString({}, { message: 'Date must be a valid ISO8601 string (e.g. 2026-06-20)' })
  date: string;
}
