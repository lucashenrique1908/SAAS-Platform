import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  RequireModulePermissions,
  RequireOrganizationRoles,
} from '../auth/decorators/authorization.decorator.js';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { BarberAccessGuard } from './barber-access.guard.js';
import {
  BusinessProfileDto,
  ClientDto,
  ProfessionalDto,
  ProfessionalManagerDto,
  ProfessionalServiceDto,
  ServiceDto,
} from './barber.dto.js';
import { BarberServiceLayer } from './barber.service.js';

@Controller('organizations/:slug/barber')
@UseGuards(OrganizationAccessGuard, BarberAccessGuard)
export class BarberController {
  constructor(private readonly barber: BarberServiceLayer) {}
  private context(req: AuthenticatedRequest) {
    return {
      org: req.organization!.id,
      user: req.authUser!.id,
      member: req.organizationMembership!,
    };
  }

  @Get('profile')
  @RequireModulePermissions('barber:read')
  profile(@Req() req: AuthenticatedRequest) {
    return this.barber.getProfile(req.organization!.id);
  }
  @Put('profile')
  @RequireOrganizationRoles('owner', 'admin')
  @RequireModulePermissions('barber:write')
  saveProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BusinessProfileDto,
  ) {
    return this.barber.saveProfile(req.organization!.id, dto);
  }

  @Get('professionals')
  @RequireModulePermissions('barber:read')
  professionals(@Req() req: AuthenticatedRequest) {
    return this.barber.listProfessionals(req.organization!.id);
  }
  @Get('professional-access')
  @RequireModulePermissions('barber:read')
  editableProfessionalIds(@Req() req: AuthenticatedRequest) {
    return this.barber.listEditableProfessionalIds(
      req.organization!.id,
      req.authUser!.id,
    );
  }
  @Post('professionals')
  @RequireModulePermissions('barber:write')
  createProfessional(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ProfessionalDto,
  ) {
    const c = this.context(req);
    return this.barber.saveProfessional(
      c.org,
      c.user,
      c.member,
      undefined,
      dto,
    );
  }
  @Put('professionals/:id')
  @RequireModulePermissions('barber:write')
  updateProfessional(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProfessionalDto,
  ) {
    const c = this.context(req);
    return this.barber.saveProfessional(c.org, c.user, c.member, id, dto);
  }
  @Delete('professionals/:id')
  @RequireOrganizationRoles('owner')
  deleteProfessional(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.barber.removeProfessional(
      req.organization!.id,
      id,
      req.organizationMembership!,
    );
  }

  @Get('services')
  @RequireModulePermissions('barber:read')
  services(@Req() req: AuthenticatedRequest) {
    return this.barber.listServices(req.organization!.id);
  }
  @Post('services')
  @RequireOrganizationRoles('owner', 'admin')
  @RequireModulePermissions('barber:write')
  createService(@Req() req: AuthenticatedRequest, @Body() dto: ServiceDto) {
    const c = this.context(req);
    return this.barber.saveService(c.org, c.user, c.member, undefined, dto);
  }
  @Put('services/:id')
  @RequireOrganizationRoles('owner', 'admin')
  @RequireModulePermissions('barber:write')
  updateService(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ServiceDto,
  ) {
    const c = this.context(req);
    return this.barber.saveService(c.org, c.user, c.member, id, dto);
  }
  @Put('professional-services')
  @RequireOrganizationRoles('owner', 'admin')
  @RequireModulePermissions('barber:write')
  setProfessionalService(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ProfessionalServiceDto,
  ) {
    return this.barber.setProfessionalService(
      req.organization!.id,
      req.organizationMembership!,
      dto.professionalId,
      dto.serviceId,
      dto.enabled !== false,
    );
  }
  @Get('professional-services')
  @RequireModulePermissions('barber:read')
  professionalServices(@Req() req: AuthenticatedRequest) {
    return this.barber.listProfessionalServices(req.organization!.id);
  }

  @Get('clients')
  @RequireModulePermissions('barber:read')
  clients(@Req() req: AuthenticatedRequest) {
    const c = this.context(req);
    return this.barber.listClients(c.org, c.user, c.member);
  }
  @Post('clients')
  @RequireModulePermissions('barber:write')
  createClient(@Req() req: AuthenticatedRequest, @Body() dto: ClientDto) {
    const c = this.context(req);
    return this.barber.saveClient(c.org, c.user, c.member, undefined, dto);
  }
  @Put('clients/:id')
  @RequireModulePermissions('barber:write')
  updateClient(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClientDto,
  ) {
    const c = this.context(req);
    return this.barber.saveClient(c.org, c.user, c.member, id, dto);
  }
  @Put('professional-managers')
  @RequireOrganizationRoles('owner', 'admin')
  setProfessionalManager(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ProfessionalManagerDto,
  ) {
    const c = this.context(req);
    return this.barber.assignManager(
      c.org,
      c.user,
      c.member,
      dto.professionalId,
      dto.userId,
      dto.enabled !== false,
    );
  }
  @Get('professional-managers')
  @RequireOrganizationRoles('owner', 'admin')
  professionalManagers(@Req() req: AuthenticatedRequest) {
    return this.barber.listProfessionalManagers(req.organization!.id);
  }
}
