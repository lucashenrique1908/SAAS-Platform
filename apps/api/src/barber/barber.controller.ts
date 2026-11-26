import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
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
  AppointmentDto,
  AppointmentStatusDto,
  AvailabilityExceptionDto,
  AvailabilityQueryDto,
  ReplaceWorkingHoursDto,
} from './barber.dto.js';
import { BarberServiceLayer } from './barber.service.js';
import { BarberSchedulingService } from './barber-scheduling.service.js';

@Controller('organizations/:slug/barber')
@UseGuards(OrganizationAccessGuard, BarberAccessGuard)
export class BarberController {
  constructor(
    private readonly barber: BarberServiceLayer,
    private readonly scheduling: BarberSchedulingService,
  ) {}
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

  @Get('working-hours')
  @RequireModulePermissions('barber:read')
  workingHours(
    @Req() req: AuthenticatedRequest,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.scheduling.getWorkingHours(
      req.organization!.id,
      professionalId,
    );
  }

  @Put('working-hours')
  @RequireModulePermissions('barber:write')
  replaceWorkingHours(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReplaceWorkingHoursDto,
  ) {
    return this.scheduling.replaceWorkingHours(
      req.organization!.id,
      req.authUser!.id,
      req.organizationMembership!,
      dto.professionalId ?? null,
      dto.periods,
    );
  }

  @Get('availability')
  @RequireModulePermissions('barber:read')
  availability(
    @Req() req: AuthenticatedRequest,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.scheduling.availability(req.organization!.id, query);
  }

  @Get('availability-exceptions')
  @RequireModulePermissions('barber:read')
  availabilityExceptions(
    @Req() req: AuthenticatedRequest,
    @Query() query: { from?: string; to?: string; professionalId?: string },
  ) {
    return this.scheduling.listExceptions(req.organization!.id, query);
  }

  @Get('availability-exceptions/:id')
  @RequireModulePermissions('barber:read')
  availabilityException(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduling.getException(req.organization!.id, id);
  }

  @Post('availability-exceptions')
  @RequireModulePermissions('barber:write')
  createAvailabilityException(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AvailabilityExceptionDto,
  ) {
    return this.scheduling.createException(
      req.organization!.id,
      req.authUser!.id,
      req.organizationMembership!,
      dto,
    );
  }

  @Put('availability-exceptions/:id')
  @RequireModulePermissions('barber:write')
  updateAvailabilityException(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AvailabilityExceptionDto,
  ) {
    return this.scheduling.updateException(
      req.organization!.id,
      id,
      req.authUser!.id,
      req.organizationMembership!,
      dto,
    );
  }

  @Delete('availability-exceptions/:id')
  @RequireModulePermissions('barber:write')
  deleteAvailabilityException(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduling.removeException(
      req.organization!.id,
      id,
      req.authUser!.id,
      req.organizationMembership!,
    );
  }

  @Get('appointments')
  @RequireModulePermissions('barber:read')
  appointments(
    @Req() req: AuthenticatedRequest,
    @Query()
    query: {
      from?: string;
      to?: string;
      date?: string;
      professionalId?: string;
      clientId?: string;
      status?: string;
    },
  ) {
    return this.scheduling.listAppointments(
      req.organization!.id,
      req.authUser!.id,
      req.organizationMembership!,
      query,
    );
  }

  @Get('appointments/:id')
  @RequireModulePermissions('barber:read')
  appointment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduling.getAppointment(
      req.organization!.id,
      id,
      req.authUser!.id,
      req.organizationMembership!,
    );
  }

  @Post('appointments')
  @RequireModulePermissions('barber:write')
  createAppointment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AppointmentDto,
  ) {
    return this.scheduling.createAppointment(
      req.organization!.id,
      req.authUser!.id,
      req.organizationMembership!,
      dto,
    );
  }

  @Put('appointments/:id')
  @RequireModulePermissions('barber:write')
  updateAppointment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppointmentDto,
  ) {
    return this.scheduling.updateAppointment(
      req.organization!.id,
      id,
      req.authUser!.id,
      req.organizationMembership!,
      dto,
    );
  }

  @Patch('appointments/:id/status')
  @RequireModulePermissions('barber:write')
  appointmentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppointmentStatusDto,
  ) {
    return this.scheduling.changeAppointmentStatus(
      req.organization!.id,
      id,
      req.authUser!.id,
      req.organizationMembership!,
      dto.status,
    );
  }

  @Get('dashboard')
  @RequireModulePermissions('barber:read')
  dashboard(@Req() req: AuthenticatedRequest) {
    return this.scheduling.dashboard(
      req.organization!.id,
      req.authUser!.id,
      req.organizationMembership!,
    );
  }
}
