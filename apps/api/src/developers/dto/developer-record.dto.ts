import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;
const stringList = () =>
  Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
      : value,
  );

export class DeveloperExperienceDto {
  @IsString() @MinLength(1) @MaxLength(160) jobTitle!: string;
  @IsString() @MinLength(1) @MaxLength(160) company!: string;
  @IsOptional() @IsString() @MaxLength(160) location?: string | null;
  @IsOptional()
  @IsIn(['full_time', 'part_time', 'contract', 'freelance', 'internship'])
  employmentType?: string | null;
  @IsOptional() @IsIn(['onsite', 'hybrid', 'remote']) workModality?:
    string | null;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @stringList()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  responsibilities?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @stringList()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  achievements?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @stringList()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  technologies?: string[];
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  companyUrl?: string | null;
}

export class DeveloperEducationDto {
  @IsString() @MinLength(1) @MaxLength(180) institution!: string;
  @IsString() @MinLength(1) @MaxLength(180) course!: string;
  @IsOptional() @IsString() @MaxLength(120) degree?: string | null;
  @IsOptional() @IsDateString() startDate?: string | null;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsBoolean() isInProgress?: boolean;
  @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  institutionUrl?: string | null;
}

export class DeveloperCertificationDto {
  @IsString() @MinLength(1) @MaxLength(180) name!: string;
  @IsString() @MinLength(1) @MaxLength(180) issuingInstitution!: string;
  @IsOptional() @IsDateString() issueDate?: string | null;
  @IsOptional() @IsDateString() expirationDate?: string | null;
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  credentialUrl?: string | null;
}

export class DeveloperProjectDto {
  @IsString() @MinLength(1) @MaxLength(180) name!: string;
  @IsString() @MinLength(1) @MaxLength(10000) description!: string;
  @IsOptional() @IsString() @MaxLength(5000) problemSolved?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @stringList()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  technologies?: string[];
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  liveUrl?: string | null;
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  repositoryUrl?: string | null;
  @IsOptional() @IsDateString() startDate?: string | null;
  @IsOptional() @IsDateString() completionDate?: string | null;
  @IsOptional() @IsIn(['in_progress', 'completed', 'archived']) status?:
    'in_progress' | 'completed' | 'archived';
  @IsOptional() @IsString() @MaxLength(160) memberRole?: string | null;
  @IsOptional() @IsIn(['individual', 'team']) projectType?:
    'individual' | 'team';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @stringList()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  mainFeatures?: string[];
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) displayOrder?: number;
}

export class DeveloperSearchQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsString() @MaxLength(120) skill?: string;
  @IsOptional() @IsString() @MaxLength(120) technology?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}
