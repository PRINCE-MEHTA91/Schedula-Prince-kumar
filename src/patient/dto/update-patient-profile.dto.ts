import { PartialType } from '@nestjs/mapped-types';
import { CreatePatientProfileDto } from './create-patient-profile.dto';

export class UpdatePatientProfileDto extends PartialType(
  CreatePatientProfileDto,
) {}
