import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import type { OrganizationRole } from '../organization-membership.entity.js';

export class AddMemberDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(['owner', 'admin', 'member'])
  role!: OrganizationRole;
}

export class ChangeRoleDto {
  @IsIn(['owner', 'admin', 'member'])
  role!: OrganizationRole;
}

export class TransferOwnershipDto {
  @IsString()
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  userId!: string;
}

export class ConfirmOrganizationDeletionDto {
  @IsString()
  @MaxLength(100)
  confirmName!: string;
}

export class InviteOrganizationMemberDto extends AddMemberDto {}

export class AcceptOrganizationInvitationDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{40,100}$/)
  token!: string;
}

export class SetMemberPermissionsDto {
  @IsArray()
  @IsIn(
    [
      'developer:read',
      'developer:write',
      'barber:read',
      'barber:write',
      'hairdresser:read',
      'hairdresser:write',
      'dentist:read',
      'dentist:write',
    ],
    { each: true },
  )
  permissions!: string[];
}

export class SetModuleStateDto {
  @IsString()
  @IsIn(['developer', 'barber', 'hairdresser', 'dentist'])
  key!: string;

  @IsBoolean()
  enabled!: boolean;
}
