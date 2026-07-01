import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class CreateDoctorProfileDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  specialization: string;

  @IsNumber()
  @IsPositive()
  @Min(0)
  experience: number;

  @IsString()
  @IsNotEmpty()
  qualification: string;

  @IsNumber()
  @IsPositive()
  consultationFee: number;

  @IsString()
  @IsNotEmpty()
  availabilityHours: string;

  @IsString()
  @IsOptional()
  profileDetails?: string;

  /**
   * Slot duration in minutes. Options: 10, 15, 20, 30, 45, 60.
   * Defaults to 15 if not provided.
   */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDuration?: number;

  @IsOptional()
  @IsString()
  @IsIn(['STREAM', 'WAVE'])
  schedulingType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPatientsPerWave?: number;

  // ── Day 20: Future Booking Configuration ──────────────────────────────────
  @IsOptional()
  @IsBoolean()
  allowFutureBooking?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxFutureBookingDays?: number;
}
