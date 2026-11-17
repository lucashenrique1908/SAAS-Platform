import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const skillKinds = ['technical', 'soft', 'language'] as const;
const proficiencyLevels = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'native',
] as const;

export class DeveloperSkillDto {
  @IsIn(skillKinds)
  kind!: (typeof skillKinds)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @IsIn(proficiencyLevels)
  proficiency?: (typeof proficiencyLevels)[number] | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(80)
  yearsExperience?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
