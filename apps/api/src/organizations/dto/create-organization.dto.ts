import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 .-]{3,79}$/)
  taxId?: string | null;
}
