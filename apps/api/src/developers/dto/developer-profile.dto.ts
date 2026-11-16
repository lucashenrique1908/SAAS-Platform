import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class DeveloperProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  biography?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? null
      : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number | null;

  @IsOptional()
  @IsIn(['available', 'open_to_offers', 'not_looking'])
  availability?: 'available' | 'open_to_offers' | 'not_looking';

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  githubUrl?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  linkedinUrl?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  websiteUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
