import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireModulePermissions } from '../auth/decorators/authorization.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { DeveloperModuleAccessGuard } from './guards/developer-module-access.guard.js';
import { DeveloperProfileDto } from './dto/developer-profile.dto.js';
import { DeveloperSkillDto } from './dto/developer-skill.dto.js';
import {
  DeveloperCertificationDto,
  DeveloperEducationDto,
  DeveloperExperienceDto,
  DeveloperProjectDto,
  DeveloperSearchQueryDto,
} from './dto/developer-record.dto.js';
import { DevelopersService } from './developers.service.js';
import {
  DeveloperFilesService,
  type BufferedDeveloperUpload,
} from './developer-files.service.js';
import { DeveloperAiService } from './developer-ai.service.js';
import { DeveloperRoadmapsService } from './developer-roadmaps.service.js';
import { DeveloperJobsService } from './developer-jobs.service.js';

@Controller('organizations/:slug/developer')
@UseGuards(OrganizationAccessGuard, DeveloperModuleAccessGuard)
export class DevelopersController {
  constructor(
    private readonly developers: DevelopersService,
    private readonly files: DeveloperFilesService,
    private readonly ai: DeveloperAiService,
    private readonly roadmaps: DeveloperRoadmapsService,
    private readonly jobs: DeveloperJobsService,
  ) {}

  @Post('cv/summary')
  @RequireModulePermissions('developer:write')
  async generateCvSummary(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const organizationId = request.organization!.id;
    const userId = request.authUser!.id;
    const profile = await this.developers.getOwnProfile(organizationId, userId);
    const include = {
      profile: body.profile !== false,
      skills: body.skills !== false,
      experience: body.experience !== false,
      education: body.education === true,
      certifications: body.certifications === true,
      projects: body.projects === true,
    };
    const [experience, education, certifications, projects] = await Promise.all(
      [
        include.experience
          ? this.developers.listExperiences(organizationId, userId)
          : [],
        include.education
          ? this.developers.listEducation(organizationId, userId)
          : [],
        include.certifications
          ? this.developers.listCertifications(organizationId, userId)
          : [],
        include.projects
          ? this.developers.listProjects(organizationId, userId)
          : [],
      ],
    );
    return {
      summary: await this.ai.generateCvSummary({
        profile: include.profile
          ? {
              name: profile.displayName,
              title: profile.title,
              biography: profile.biography,
            }
          : null,
        skills: include.skills ? profile.skills.map((skill) => skill.name) : [],
        experience: experience.map((item) => ({
          role: item.jobTitle,
          company: item.company,
          description: item.description ?? '',
        })),
        education: education.map((item) => ({
          course: item.course,
          institution: item.institution,
          degree: item.degree,
        })),
        certifications: certifications.map((item) => ({
          name: item.name,
          issuingInstitution: item.issuingInstitution,
        })),
        projects: projects.map((item) => ({
          name: item.name,
          description: item.description,
          technologies: item.technologies,
        })),
      }),
    };
  }

  @Get('cv')
  async getCvData(@Req() request: AuthenticatedRequest) {
    const organizationId = request.organization!.id;
    const userId = request.authUser!.id;
    const [profile, experience, education, certifications, projects] =
      await Promise.all([
        this.developers.getOwnProfile(organizationId, userId),
        this.developers.listExperiences(organizationId, userId),
        this.developers.listEducation(organizationId, userId),
        this.developers.listCertifications(organizationId, userId),
        this.developers.listProjects(organizationId, userId),
      ]);
    return { profile, experience, education, certifications, projects };
  }

  @Get('roadmaps')
  listRoadmaps(@Req() request: AuthenticatedRequest) {
    return this.roadmaps.list(request.organization!.id, request.authUser!.id);
  }

  @Post('roadmaps')
  @RequireModulePermissions('developer:write')
  createRoadmap(
    @Req() request: AuthenticatedRequest,
    @Body('goal') goal: unknown,
  ) {
    return this.roadmaps.create(
      request.organization!.id,
      request.authUser!.id,
      goal,
    );
  }

  @Post('roadmaps/generate')
  @RequireModulePermissions('developer:write')
  async generateRoadmap(
    @Req() request: AuthenticatedRequest,
    @Body('goal') goal: unknown,
  ) {
    if (typeof goal !== 'string' || !goal.trim() || goal.length > 160)
      throw new BadRequestException('Goal must contain 1 to 160 characters.');
    const profile = await this.developers.getOwnProfile(
      request.organization!.id,
      request.authUser!.id,
    );
    const items = await this.ai.generateRoadmap(
      goal.trim(),
      profile.skills.map((skill) => skill.name),
    );
    const roadmap = await this.roadmaps.create(
      request.organization!.id,
      request.authUser!.id,
      goal,
    );
    return this.roadmaps.update(
      request.organization!.id,
      request.authUser!.id,
      roadmap.id,
      goal,
      items,
    );
  }

  @Put('roadmaps/:id')
  @RequireModulePermissions('developer:write')
  updateRoadmap(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { goal?: unknown; items?: unknown },
  ) {
    return this.roadmaps.update(
      request.organization!.id,
      request.authUser!.id,
      id,
      body.goal,
      body.items,
    );
  }

  @Delete('roadmaps/:id')
  @RequireModulePermissions('developer:write')
  deleteRoadmap(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roadmaps.remove(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
  }

  @Get('jobs')
  searchJobs(
    @Query()
    query: {
      q?: string;
      location?: string;
      country?: string;
      page?: string;
      remote?: string;
      workplace?: string;
    },
  ) {
    return this.jobs.search({
      query: query.q,
      location: query.location,
      country: query.country,
      page: Number(query.page ?? 1),
      remote: query.remote,
      workplace: query.workplace,
    });
  }

  @Get('search/members')
  searchMembers(
    @Req() request: AuthenticatedRequest,
    @Query() query: DeveloperSearchQueryDto,
  ) {
    return this.developers.searchMembers(request.organization!.id, query);
  }

  @Get('search/projects')
  searchProjects(
    @Req() request: AuthenticatedRequest,
    @Query() query: DeveloperSearchQueryDto,
  ) {
    return this.developers.searchProjects(request.organization!.id, query);
  }

  @Get('profile')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.developers.getOwnProfile(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Put('profile')
  @RequireModulePermissions('developer:write')
  saveProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeveloperProfileDto,
  ) {
    return this.developers.saveOwnProfile(
      request.organization!.id,
      request.authUser!.id,
      body,
    );
  }

  @Get('profiles/:publicId')
  getOrganizationProfile(
    @Req() request: AuthenticatedRequest,
    @Param('publicId', ParseUUIDPipe) publicId: string,
  ) {
    return this.developers.getOrganizationProfile(
      request.organization!.id,
      publicId,
    );
  }

  @Get('skills')
  listSkills(@Req() request: AuthenticatedRequest) {
    return this.developers.listOwnSkills(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Post('skills')
  @RequireModulePermissions('developer:write')
  addSkill(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeveloperSkillDto,
  ) {
    return this.developers.addSkill(
      request.organization!.id,
      request.authUser!.id,
      body,
    );
  }

  @Put('skills/:skillId')
  @RequireModulePermissions('developer:write')
  updateSkill(
    @Req() request: AuthenticatedRequest,
    @Param('skillId') skillId: string,
    @Body() body: DeveloperSkillDto,
  ) {
    return this.developers.updateSkill(
      request.organization!.id,
      request.authUser!.id,
      skillId,
      body,
    );
  }

  @Delete('skills/:skillId')
  @RequireModulePermissions('developer:write')
  removeSkill(
    @Req() request: AuthenticatedRequest,
    @Param('skillId') skillId: string,
  ) {
    return this.developers.removeSkill(
      request.organization!.id,
      request.authUser!.id,
      skillId,
    );
  }

  @Get('experiences')
  listExperiences(@Req() request: AuthenticatedRequest) {
    return this.developers.listExperiences(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Post('experiences')
  @RequireModulePermissions('developer:write')
  createExperience(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeveloperExperienceDto,
  ) {
    return this.developers.createExperience(
      request.organization!.id,
      request.authUser!.id,
      body,
    );
  }

  @Put('experiences/:id')
  @RequireModulePermissions('developer:write')
  updateExperience(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeveloperExperienceDto,
  ) {
    return this.developers.updateExperience(
      request.organization!.id,
      request.authUser!.id,
      id,
      body,
    );
  }

  @Delete('experiences/:id')
  @RequireModulePermissions('developer:write')
  removeExperience(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.developers.removeExperience(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
  }

  @Get('education')
  listEducation(@Req() request: AuthenticatedRequest) {
    return this.developers.listEducation(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Post('education')
  @RequireModulePermissions('developer:write')
  createEducation(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeveloperEducationDto,
  ) {
    return this.developers.createEducation(
      request.organization!.id,
      request.authUser!.id,
      body,
    );
  }

  @Put('education/:id')
  @RequireModulePermissions('developer:write')
  updateEducation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeveloperEducationDto,
  ) {
    return this.developers.updateEducation(
      request.organization!.id,
      request.authUser!.id,
      id,
      body,
    );
  }

  @Delete('education/:id')
  @RequireModulePermissions('developer:write')
  removeEducation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.developers.removeEducation(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
  }

  @Get('certifications')
  listCertifications(@Req() request: AuthenticatedRequest) {
    return this.developers.listCertifications(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Post('certifications')
  @RequireModulePermissions('developer:write')
  createCertification(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeveloperCertificationDto,
  ) {
    return this.developers.createCertification(
      request.organization!.id,
      request.authUser!.id,
      body,
    );
  }

  @Put('certifications/:id')
  @RequireModulePermissions('developer:write')
  updateCertification(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeveloperCertificationDto,
  ) {
    return this.developers.updateCertification(
      request.organization!.id,
      request.authUser!.id,
      id,
      body,
    );
  }

  @Delete('certifications/:id')
  @RequireModulePermissions('developer:write')
  removeCertification(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.developers.removeCertification(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
  }

  @Get('projects')
  listProjects(@Req() request: AuthenticatedRequest) {
    return this.developers.listProjects(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Post('projects')
  @RequireModulePermissions('developer:write')
  createProject(
    @Req() request: AuthenticatedRequest,
    @Body() body: DeveloperProjectDto,
  ) {
    return this.developers.createProject(
      request.organization!.id,
      request.authUser!.id,
      body,
    );
  }

  @Put('projects/:id')
  @RequireModulePermissions('developer:write')
  updateProject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeveloperProjectDto,
  ) {
    return this.developers.updateProject(
      request.organization!.id,
      request.authUser!.id,
      id,
      body,
    );
  }

  @Delete('projects/:id')
  @RequireModulePermissions('developer:write')
  removeProject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.developers.removeProject(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
  }

  @Post('files/profile-photo')
  @RequireModulePermissions('developer:write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadProfilePhoto(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: BufferedDeveloperUpload,
  ) {
    return this.files.uploadProfilePhoto(
      request.organization!.id,
      request.authUser!.id,
      file,
    );
  }

  @Post('files/projects/:projectId/cover')
  @RequireModulePermissions('developer:write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadProjectCover(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: BufferedDeveloperUpload,
  ) {
    return this.files.uploadProjectCover(
      request.organization!.id,
      request.authUser!.id,
      projectId,
      file,
    );
  }

  @Post('files/certifications/:certificationId')
  @RequireModulePermissions('developer:write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', ParseUUIDPipe) id: string,
    @UploadedFile() file: BufferedDeveloperUpload,
  ) {
    return this.files.uploadCertificate(
      request.organization!.id,
      request.authUser!.id,
      id,
      file,
    );
  }

  @Get('files/:fileId')
  async getFile(
    @Req() request: AuthenticatedRequest,
    @Param('fileId', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.files.getOrganizationFile(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      this.fileDisposition(file.mimeType, file.purpose, file.originalName),
    );
    return new StreamableFile(file.buffer, { type: file.mimeType });
  }

  @Delete('files/:fileId')
  @RequireModulePermissions('developer:write')
  removeFile(
    @Req() request: AuthenticatedRequest,
    @Param('fileId', ParseUUIDPipe) id: string,
  ) {
    return this.files.deleteFile(
      request.organization!.id,
      request.authUser!.id,
      id,
    );
  }

  private fileDisposition(
    mimeType: string,
    purpose: string,
    originalName: string,
  ) {
    const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, '_');
    return mimeType.startsWith('image/') && purpose !== 'certificate'
      ? `inline; filename="${safeName}"`
      : `attachment; filename="${safeName}"`;
  }
}

@Controller('developers')
export class PublicDevelopersController {
  constructor(
    private readonly developers: DevelopersService,
    private readonly files: DeveloperFilesService,
  ) {}

  @Get(':publicId')
  @Public()
  getPublicProfile(@Param('publicId') publicId: string) {
    return this.developers.getPublicProfile(publicId);
  }

  @Get(':publicId/files/:fileId')
  @Public()
  async getPublicFile(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.files.getPublicFile(publicId, fileId);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      this.fileDisposition(file.mimeType, file.purpose, file.originalName),
    );
    return new StreamableFile(file.buffer, { type: file.mimeType });
  }

  private fileDisposition(
    mimeType: string,
    purpose: string,
    originalName: string,
  ) {
    const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, '_');
    return mimeType.startsWith('image/') && purpose !== 'certificate'
      ? `inline; filename="${safeName}"`
      : `attachment; filename="${safeName}"`;
  }
}
