import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetDoctorsQueryDto {
  // ?specialization=cardiologist — case-insensitive filter
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'specialization blank nahi ho sakta' })
  specialization?: string;

  // ?search=rahul — naam se partial search
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'search blank nahi ho sakta' })
  search?: string;

  // ?page=2 — kaun sa page chahiye (default: 1)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page ek number hona chahiye' })
  @Min(1, { message: 'page minimum 1 hona chahiye' })
  page?: number = 1;

  // ?limit=10 — ek page mein kitne results (default: 10, max: 100)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit ek number hona chahiye' })
  @Min(1, { message: 'limit minimum 1 hona chahiye' })
  @Max(100, { message: 'limit 100 se zyada nahi ho sakta' })
  limit?: number = 10;

  // ?availability=true — sirf available/unavailable doctors filter karo
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true; // string "true" → boolean true
    if (value === 'false') return false; // string "false" → boolean false
    return value;
  })
  @IsBoolean({ message: 'availability sirf true ya false ho sakta hai' })
  availability?: boolean;
}
