import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsTimeZone,
  IsDateString,
  Matches,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BusinessProfileDto {
  @IsString() @MaxLength(160) businessName!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsString() @IsTimeZone() @MaxLength(64) timezone?: string;
}

export class ProfessionalDto {
  @IsString() @MaxLength(160) displayName!: string;
  @IsOptional() @IsString() @MaxLength(4000) bio?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string | null;
  @IsOptional() @IsUUID() userId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ServiceDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsInt() @Min(0) @Max(10000000) priceCents!: number;
  @IsInt() @Min(1) @Max(1440) durationMinutes!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ClientDto {
  @IsString() @MaxLength(160) fullName!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string | null;
  @IsOptional() @IsUUID() responsibleProfessionalId?: string | null;
}

export class ProfessionalServiceDto {
  @IsUUID() professionalId!: string;
  @IsUUID() serviceId!: string;
  @IsBoolean() enabled!: boolean;
}

export class ProfessionalManagerDto {
  @IsUUID() professionalId!: string;
  @IsUUID() userId!: string;
  @IsBoolean() enabled!: boolean;
}

export class WorkingHoursDto {
  @IsOptional() @IsUUID() professionalId?: string | null;
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
}

export class ReplaceWorkingHoursDto {
  @IsOptional() @IsUUID() professionalId?: string | null;
  @IsArray()
  @ArrayMaxSize(56)
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDto)
  periods!: WorkingHoursDto[];
}

export class AvailabilityQueryDto {
  @IsUUID() serviceId!: string;
  @IsDateString() date!: string;
  @IsOptional() @IsUUID() professionalId?: string;
  @IsOptional() @IsUUID() excludingAppointmentId?: string;
}

export class AvailabilityExceptionDto {
  @IsOptional() @IsUUID() professionalId?: string | null;
  @IsIn(['DAY_OFF', 'VACATION', 'ABSENCE', 'APPOINTMENT', 'BLOCK'])
  type!: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string | null;
  @IsDateString({ strict: true }) date!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @IsDateString({ strict: true }) endDate!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
}

export class AppointmentDto {
  @IsUUID() clientId!: string;
  @IsUUID() professionalId!: string;
  @IsUUID() serviceId!: string;
  @IsDateString({ strict: true }) date!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

export class AppointmentStatusDto {
  @IsIn(['CONFIRMED', 'COMPLETED', 'CANCELLED']) status!: string;
}
