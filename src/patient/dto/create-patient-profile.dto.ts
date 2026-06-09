import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Gender } from '../entities/patient-profile.entity';

export class CreatePatientProfileDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  age: number;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @IsNotEmpty()
  contactDetails: string;

  @IsString()
  @IsOptional()
  basicHealthInfo?: string;
}
