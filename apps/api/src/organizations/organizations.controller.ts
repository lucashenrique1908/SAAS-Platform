import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { RequireOrganizationRoles } from '../auth/decorators/authorization.decorator.js';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import {
  AcceptOrganizationInvitationDto,
  AddMemberDto,
  ChangeRoleDto,
  ConfirmOrganizationDeletionDto,
  InviteOrganizationMemberDto,
  SetMemberPermissionsDto,
  SetModuleStateDto,
  TransferOwnershipDto,
} from './dto/organization-action.dto.js';
import { ORGANIZATION_MODULES } from './organization-module.entity.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.organizations.list(request.authUser!.id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateOrganizationDto,
  ) {
    return this.organizations.create(request.authUser!.id, body);
  }

  @Get('slug-availability')
  slugAvailability(
    @Query('slug') slug: string,
    @Query('exclude') exclude?: string,
  ) {
    return this.organizations.suggestSlug(slug ?? '', exclude);
  }

  @Post('invitations/accept')
  acceptInvitation(
    @Req() request: AuthenticatedRequest,
    @Body() body: AcceptOrganizationInvitationDto,
  ) {
    return this.organizations.acceptInvitation(
      request.authUser!.id,
      body.token,
    );
  }

  @Get(':slug')
  @UseGuards(OrganizationAccessGuard)
  getOrganization(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    return this.organizations.getBySlug(request.authUser!.id, slug);
  }

  @Post(':slug/active')
  @UseGuards(OrganizationAccessGuard)
  setActive(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.organizations.setActiveOrganization(
      request.authUser!.id,
      request.authSession!.id,
      slug,
    );
  }

  @Patch(':slug')
  @UseGuards(OrganizationAccessGuard)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: UpdateOrganizationDto,
  ) {
    return this.organizations.update(request.authUser!.id, slug, body);
  }

  @Patch(':slug/deactivate')
  @UseGuards(OrganizationAccessGuard)
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    return this.organizations.deactivate(request.authUser!.id, slug);
  }

  @Patch(':slug/reactivate')
  reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    return this.organizations.reactivate(request.authUser!.id, slug);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  removePermanently(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: ConfirmOrganizationDeletionDto,
  ) {
    return this.organizations.removePermanently(
      request.authUser!.id,
      slug,
      body.confirmName,
    );
  }

  @Get(':slug/members')
  @UseGuards(OrganizationAccessGuard)
  listMembers(@Param('slug') slug: string) {
    return this.organizations.listMembers(slug);
  }

  @Post(':slug/members')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  addMember(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: AddMemberDto,
  ) {
    return this.organizations.addMember(
      request.authUser!.id,
      slug,
      body.email,
      body.role,
    );
  }

  @Patch(':slug/members/:userId/role')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner')
  changeRole(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() body: ChangeRoleDto,
  ) {
    return this.organizations.changeRole(
      request.authUser!.id,
      slug,
      userId,
      body.role,
    );
  }

  @Patch(':slug/members/:userId/permissions')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  setMemberPermissions(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() body: SetMemberPermissionsDto,
  ) {
    return this.organizations.setMemberPermissions(
      request.authUser!.id,
      slug,
      userId,
      body.permissions,
    );
  }

  @Delete(':slug/members/:userId')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('userId') userId: string,
  ) {
    return this.organizations.removeMember(request.authUser!.id, slug, userId);
  }

  @Post(':slug/members/me/leave')
  @UseGuards(OrganizationAccessGuard)
  @HttpCode(HttpStatus.OK)
  leave(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.organizations.leave(request.authUser!.id, slug);
  }

  @Post(':slug/ownership/transfer')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner')
  transferOwnership(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: TransferOwnershipDto,
  ) {
    return this.organizations.transferOwnership(
      request.authUser!.id,
      slug,
      body.userId,
    );
  }

  @Get(':slug/invitations')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  listInvitations(@Param('slug') slug: string) {
    return this.organizations.listInvitations(slug);
  }

  @Post(':slug/invitations')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  invite(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: InviteOrganizationMemberDto,
  ) {
    return this.organizations.invite(
      request.authUser!.id,
      slug,
      body.email,
      body.role,
    );
  }

  @Delete(':slug/invitations/:invitationId')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  revokeInvitation(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.organizations.revokeInvitation(
      request.authUser!.id,
      slug,
      invitationId,
    );
  }

  @Get(':slug/modules')
  @UseGuards(OrganizationAccessGuard)
  modules(@Param('slug') slug: string) {
    return this.organizations.listModules(slug);
  }

  @Patch(':slug/modules')
  @UseGuards(OrganizationAccessGuard)
  @RequireOrganizationRoles('owner', 'admin')
  setModuleState(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: SetModuleStateDto,
  ) {
    return this.organizations.setModuleEnabled(
      request.authUser!.id,
      slug,
      body.key as (typeof ORGANIZATION_MODULES)[number],
      body.enabled,
    );
  }

  @Get(':slug/modules/:key')
  @UseGuards(OrganizationAccessGuard)
  getModule(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('key') key: string,
  ) {
    if (!(ORGANIZATION_MODULES as readonly string[]).includes(key))
      return this.organizations.getUnavailableModule();
    return this.organizations.getModule(
      request.authUser!.id,
      slug,
      key as (typeof ORGANIZATION_MODULES)[number],
    );
  }
}
