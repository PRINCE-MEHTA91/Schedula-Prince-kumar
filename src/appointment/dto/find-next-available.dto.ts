import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for finding the next available appointment slot for a doctor.
 * Used as a query parameter: GET /appointment/next-available?doctorId=3
 */
export class FindNextAvailableDto {
  @Type(() => Number)
  @IsInt({ message: 'doctorId must be an integer' })
  @IsPositive({ message: 'doctorId must be a positive number' })
  doctorId: number;
}
