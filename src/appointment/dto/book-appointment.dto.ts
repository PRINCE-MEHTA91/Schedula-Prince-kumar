import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SchedulingType } from '../entities/appointment.entity';

export class BookAppointmentDto {
  @IsInt()
  @IsPositive()
  doctorId: number;

  @IsEnum(SchedulingType)
  schedulingType: SchedulingType;

  /**
   * Required when schedulingType = STREAM.
   * The ID of the stream slot to book.
   */
  @ValidateIf((o) => o.schedulingType === SchedulingType.STREAM)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  streamSlotId?: number;

  /**
   * Required when schedulingType = WAVE.
   * The ID of the wave schedule to join.
   */
  @ValidateIf((o) => o.schedulingType === SchedulingType.WAVE)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  waveScheduleId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
