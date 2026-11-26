import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
