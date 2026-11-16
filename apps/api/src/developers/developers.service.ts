import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/organization.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { DeveloperProfile } from './developer-profile.entity.js';
import { DeveloperSkill } from './developer-skill.entity.js';
import { DeveloperExperience } from './developer-experience.entity.js';
import { DeveloperEducation } from './developer-education.entity.js';
import { DeveloperCertification } from './developer-certification.entity.js';
import { DeveloperProject } from './developer-project.entity.js';
import type { DeveloperProfileDto } from './dto/developer-profile.dto.js';
import type { DeveloperSkillDto } from './dto/developer-skill.dto.js';
import type {
  DeveloperCertificationDto,
  DeveloperEducationDto,
  DeveloperExperienceDto,
  DeveloperProjectDto,
} from './dto/developer-record.dto.js';

@Injectable()
export class DevelopersService {
  constructor(
    @InjectRepository(DeveloperProfile)
    private readonly profiles: Repository<DeveloperProfile>,
    @InjectRepository(DeveloperSkill)
    private readonly skills: Repository<DeveloperSkill>,
    @InjectRepository(DeveloperExperience)
    private readonly experiences: Repository<DeveloperExperience>,
    @InjectRepository(DeveloperEducation)
    private readonly education: Repository<DeveloperEducation>,
    @InjectRepository(DeveloperCertification)
    private readonly certifications: Repository<DeveloperCertification>,
    @InjectRepository(DeveloperProject)
    private readonly projects: Repository<DeveloperProject>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
  ) {}

  async getOwnProfile(organizationId: string, userId: string) {
    const profile = await this.profiles.findOne({
      where: { organizationId, userId },
    });
    if (!profile) throw new NotFoundException('Developer profile not found.');
    const skills = await this.skills.find({
      where: { profileId: profile.id },
      order: { kind: 'ASC', name: 'ASC' },
    });
    return Object.assign({}, profile, { skills });
  }

  async saveOwnProfile(
    organizationId: string,
    userId: string,
    input: DeveloperProfileDto,
  ) {
    const membership = await this.memberships.findOne({
      where: { organizationId, userId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Organization not found.');

    let profile = await this.profiles.findOne({
      where: { organizationId, userId },
    });
    if (profile) {
      Object.assign(profile, input);
      return this.profiles.save(profile);
    }
    profile = this.profiles.create({
      organizationId,
      userId,
      displayName: input.displayName,
      title: input.title ?? null,
      biography: input.biography ?? null,
      location: input.location ?? null,
      yearsExperience: input.yearsExperience ?? null,
      availability: input.availability ?? 'open_to_offers',
      githubUrl: input.githubUrl ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
      isPublic: input.isPublic ?? true,
      photoFileId: null,
    });
    try {
      return await this.profiles.save(profile);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('A developer profile already exists.');
      }
      throw error;
    }
  }

  async listOwnSkills(organizationId: string, userId: string) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.skills.find({
      where: { profileId: profile.id },
      order: { kind: 'ASC', name: 'ASC' },
    });
  }

  async addSkill(
    organizationId: string,
    userId: string,
    input: DeveloperSkillDto,
  ) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    try {
      return await this.skills.save(
        this.skills.create({
          profileId: profile.id,
          kind: input.kind,
          name: input.name.trim(),
          category: input.category?.trim() || null,
          proficiency: input.proficiency ?? null,
          yearsExperience: input.yearsExperience ?? null,
          description: input.description?.trim() || null,
        }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('This skill is already in the profile.');
      }
      throw error;
    }
  }

  async updateSkill(
    organizationId: string,
    userId: string,
    skillId: string,
    input: DeveloperSkillDto,
  ) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    const skill = await this.skills.findOne({
      where: { id: skillId, profileId: profile.id },
    });
    if (!skill) throw new NotFoundException('Skill not found.');
    Object.assign(skill, input, {
      name: input.name.trim(),
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
    });
    try {
      return await this.skills.save(skill);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('This skill is already in the profile.');
      }
      throw error;
    }
  }

  async removeSkill(organizationId: string, userId: string, skillId: string) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    const result = await this.skills.delete({
      id: skillId,
      profileId: profile.id,
    });
    if (!result.affected) throw new NotFoundException('Skill not found.');
    return { success: true };
  }

  async listExperiences(organizationId: string, userId: string) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.experiences.find({
      where: { profileId: profile.id },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createExperience(
    organizationId: string,
    userId: string,
    input: DeveloperExperienceDto,
  ) {
    this.validateDates(input.startDate, input.endDate);
    if (input.isCurrent && input.endDate) {
      throw new BadRequestException(
        'Current positions cannot have an end date.',
      );
    }
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.experiences.save(
      this.experiences.create(
        Object.assign({ profileId: profile.id }, input, {
          isCurrent: input.isCurrent ?? false,
          responsibilities: input.responsibilities ?? [],
          achievements: input.achievements ?? [],
          technologies: input.technologies ?? [],
          location: input.location ?? null,
          employmentType: input.employmentType ?? null,
          workModality: input.workModality ?? null,
          endDate: input.endDate ?? null,
          description: input.description ?? null,
          companyUrl: input.companyUrl ?? null,
        }),
      ),
    );
  }

  async updateExperience(
    organizationId: string,
    userId: string,
    id: string,
    input: DeveloperExperienceDto,
  ) {
    const record = await this.findOwnedRecord(
      this.experiences,
      organizationId,
      userId,
      id,
    );
    const endDate =
      input.endDate === undefined ? record.endDate : input.endDate;
    this.validateDates(input.startDate, endDate);
    if ((input.isCurrent ?? record.isCurrent) && endDate) {
      throw new BadRequestException(
        'Current positions cannot have an end date.',
      );
    }
    Object.assign(record, input);
    return this.experiences.save(record);
  }

  removeExperience(organizationId: string, userId: string, id: string) {
    return this.removeOwnedRecord(this.experiences, organizationId, userId, id);
  }

  async listEducation(organizationId: string, userId: string) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.education.find({
      where: { profileId: profile.id },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createEducation(
    organizationId: string,
    userId: string,
    input: DeveloperEducationDto,
  ) {
    this.validateDates(input.startDate, input.endDate);
    if (input.isInProgress && input.endDate) {
      throw new BadRequestException(
        'In-progress education cannot have an end date.',
      );
    }
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.education.save(
      this.education.create({
        profileId: profile.id,
        institution: input.institution.trim(),
        course: input.course.trim(),
        degree: input.degree ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        isInProgress: input.isInProgress ?? false,
        description: input.description ?? null,
        institutionUrl: input.institutionUrl ?? null,
      }),
    );
  }

  async updateEducation(
    organizationId: string,
    userId: string,
    id: string,
    input: DeveloperEducationDto,
  ) {
    const record = await this.findOwnedRecord(
      this.education,
      organizationId,
      userId,
      id,
    );
    const endDate =
      input.endDate === undefined ? record.endDate : input.endDate;
    this.validateDates(input.startDate ?? record.startDate, endDate);
    if ((input.isInProgress ?? record.isInProgress) && endDate) {
      throw new BadRequestException(
        'In-progress education cannot have an end date.',
      );
    }
    Object.assign(record, input);
    return this.education.save(record);
  }

  removeEducation(organizationId: string, userId: string, id: string) {
    return this.removeOwnedRecord(this.education, organizationId, userId, id);
  }

  async listCertifications(organizationId: string, userId: string) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.certifications.find({
      where: { profileId: profile.id },
      order: { issueDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createCertification(
    organizationId: string,
    userId: string,
    input: DeveloperCertificationDto,
  ) {
    this.validateDates(input.issueDate, input.expirationDate);
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.certifications.save(
      this.certifications.create({
        profileId: profile.id,
        name: input.name.trim(),
        issuingInstitution: input.issuingInstitution.trim(),
        issueDate: input.issueDate ?? null,
        expirationDate: input.expirationDate ?? null,
        credentialUrl: input.credentialUrl ?? null,
        certificateFileId: null,
      }),
    );
  }

  async updateCertification(
    organizationId: string,
    userId: string,
    id: string,
    input: DeveloperCertificationDto,
  ) {
    const record = await this.findOwnedRecord(
      this.certifications,
      organizationId,
      userId,
      id,
    );
    this.validateDates(
      input.issueDate === undefined ? record.issueDate : input.issueDate,
      input.expirationDate === undefined
        ? record.expirationDate
        : input.expirationDate,
    );
    Object.assign(record, input);
    return this.certifications.save(record);
  }

  removeCertification(organizationId: string, userId: string, id: string) {
    return this.removeOwnedRecord(
      this.certifications,
      organizationId,
      userId,
      id,
    );
  }

  async listProjects(organizationId: string, userId: string) {
    const profile = await this.requireOwnProfile(organizationId, userId);
    return this.projects.find({
      where: { profileId: profile.id },
      order: { isFeatured: 'DESC', displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async searchMembers(
    organizationId: string,
    query: { q?: string; skill?: string; page?: number; pageSize?: number },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const builder = this.profiles
      .createQueryBuilder('profile')
      .select([
        'profile.publicId',
        'profile.displayName',
        'profile.title',
        'profile.location',
        'profile.availability',
      ])
      .where('profile.organizationId = :organizationId', { organizationId })
      .andWhere(
        'EXISTS (SELECT 1 FROM organization_memberships member WHERE member.organization_id = profile.organization_id AND member.user_id = profile.user_id)',
      );
    if (query.q?.trim()) {
      builder.andWhere(
        '(profile.displayName ILIKE :term OR profile.title ILIKE :term)',
        { term: `%${query.q.trim()}%` },
      );
    }
    if (query.skill?.trim()) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM developer_skills skill WHERE skill.profile_id = profile.id AND skill.kind = 'technical' AND skill.name ILIKE :skill)`,
        { skill: `%${query.skill.trim()}%` },
      );
    }
    const [profiles, total] = await builder
      .orderBy('profile.displayName', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data: profiles, page, pageSize, total };
  }

  async searchProjects(
    organizationId: string,
    query: {
      q?: string;
      technology?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const builder = this.projects
      .createQueryBuilder('project')
      .innerJoin(DeveloperProfile, 'profile', 'profile.id = project.profileId')
      .where('profile.organizationId = :organizationId', { organizationId })
      .andWhere(
        'EXISTS (SELECT 1 FROM organization_memberships member WHERE member.organization_id = profile.organization_id AND member.user_id = profile.user_id)',
      );
    if (query.q?.trim()) {
      builder.andWhere(
        '(project.name ILIKE :term OR project.description ILIKE :term)',
        { term: `%${query.q.trim()}%` },
      );
    }
    if (query.technology?.trim()) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(project.technologies) AS technology WHERE technology ILIKE :technology)`,
        { technology: `%${query.technology.trim()}%` },
      );
    }
    const [projects, total] = await builder
      .orderBy('project.isFeatured', 'DESC')
      .addOrderBy('project.displayOrder', 'ASC')
      .addOrderBy('project.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data: projects, page, pageSize, total };
  }

  async createProject(
    organizationId: string,
    userId: string,
    input: DeveloperProjectDto,
  ) {
    this.validateDates(input.startDate, input.completionDate);
    const profile = await this.requireOwnProfile(organizationId, userId);
    if (
      input.repositoryUrl &&
      (await this.projects.findOne({
        where: { profileId: profile.id, repositoryUrl: input.repositoryUrl },
        select: { id: true },
      }))
    ) {
      throw new ConflictException(
        'This repository is already in the portfolio.',
      );
    }
    return this.projects.save(
      this.projects.create({
        profileId: profile.id,
        name: input.name.trim(),
        description: input.description.trim(),
        problemSolved: input.problemSolved ?? null,
        coverFileId: null,
        technologies: input.technologies ?? [],
        liveUrl: input.liveUrl ?? null,
        repositoryUrl: input.repositoryUrl ?? null,
        startDate: input.startDate ?? null,
        completionDate: input.completionDate ?? null,
        status: input.status ?? 'in_progress',
        memberRole: input.memberRole ?? null,
        projectType: input.projectType ?? 'individual',
        mainFeatures: input.mainFeatures ?? [],
        isFeatured: input.isFeatured ?? false,
        displayOrder: input.displayOrder ?? 0,
      }),
    );
  }

  async updateProject(
    organizationId: string,
    userId: string,
    id: string,
    input: DeveloperProjectDto,
  ) {
    const record = await this.findOwnedRecord(
      this.projects,
      organizationId,
      userId,
      id,
    );
    this.validateDates(
      input.startDate === undefined ? record.startDate : input.startDate,
      input.completionDate === undefined
        ? record.completionDate
        : input.completionDate,
    );
    const repositoryUrl =
      input.repositoryUrl === undefined
        ? record.repositoryUrl
        : input.repositoryUrl;
    if (repositoryUrl) {
      const duplicate = await this.projects.findOne({
        where: { profileId: record.profileId, repositoryUrl },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException(
          'This repository is already in the portfolio.',
        );
    }
    Object.assign(record, input);
    if (input.name !== undefined) record.name = input.name.trim();
    if (input.description !== undefined)
      record.description = input.description.trim();
    return this.projects.save(record);
  }

  removeProject(organizationId: string, userId: string, id: string) {
    return this.removeOwnedRecord(this.projects, organizationId, userId, id);
  }

  async getPublicProfile(publicId: string) {
    const profile = await this.profiles.findOne({
      where: { publicId, isPublic: true },
    });
    if (!profile) throw new NotFoundException('Developer profile not found.');
    const [organization, membership] = await Promise.all([
      this.organizations.findOne({
        where: { id: profile.organizationId, isActive: true },
        select: { id: true },
      }),
      this.memberships.findOne({
        where: {
          organizationId: profile.organizationId,
          userId: profile.userId,
        },
        select: { id: true },
      }),
    ]);
    if (!organization || !membership) {
      throw new NotFoundException('Developer profile not found.');
    }
    const [skills, experiences, education, certifications, projects] =
      await Promise.all([
        this.skills.find({
          where: { profileId: profile.id },
          order: { kind: 'ASC', name: 'ASC' },
        }),
        this.experiences.find({
          where: { profileId: profile.id },
          order: { startDate: 'DESC' },
        }),
        this.education.find({
          where: { profileId: profile.id },
          order: { startDate: 'DESC' },
        }),
        this.certifications.find({
          where: { profileId: profile.id },
          order: { issueDate: 'DESC' },
        }),
        this.projects.find({
          where: { profileId: profile.id },
          order: { isFeatured: 'DESC', displayOrder: 'ASC' },
        }),
      ]);
    return {
      publicId: profile.publicId,
      displayName: profile.displayName,
      title: profile.title,
      biography: profile.biography,
      location: profile.location,
      yearsExperience: profile.yearsExperience,
      availability: profile.availability,
      githubUrl: profile.githubUrl,
      linkedinUrl: profile.linkedinUrl,
      websiteUrl: profile.websiteUrl,
      photoUrl: profile.photoFileId
        ? `/api/developers/${profile.publicId}/files/${profile.photoFileId}`
        : null,
      skills: skills.map(
        ({
          kind,
          name,
          category,
          proficiency,
          yearsExperience,
          description,
        }) => ({
          kind,
          name,
          category,
          proficiency,
          yearsExperience,
          description,
        }),
      ),
      experiences: experiences.map(
        ({
          jobTitle,
          company,
          location,
          employmentType,
          workModality,
          startDate,
          endDate,
          isCurrent,
          description,
          responsibilities,
          achievements,
          technologies,
          companyUrl,
        }) => ({
          jobTitle,
          company,
          location,
          employmentType,
          workModality,
          startDate,
          endDate,
          isCurrent,
          description,
          responsibilities,
          achievements,
          technologies,
          companyUrl,
        }),
      ),
      education: education.map(
        ({
          institution,
          course,
          degree,
          startDate,
          endDate,
          isInProgress,
          description,
          institutionUrl,
        }) => ({
          institution,
          course,
          degree,
          startDate,
          endDate,
          isInProgress,
          description,
          institutionUrl,
        }),
      ),
      certifications: certifications.map(
        ({
          name,
          issuingInstitution,
          issueDate,
          expirationDate,
          credentialUrl,
        }) => ({
          name,
          issuingInstitution,
          issueDate,
          expirationDate,
          credentialUrl,
        }),
      ),
      projects: projects.map(
        ({
          name,
          description,
          problemSolved,
          coverFileId,
          technologies,
          liveUrl,
          repositoryUrl,
          startDate,
          completionDate,
          status,
          memberRole,
          projectType,
          mainFeatures,
          isFeatured,
          displayOrder,
        }) => ({
          name,
          description,
          problemSolved,
          coverUrl: coverFileId
            ? `/api/developers/${profile.publicId}/files/${coverFileId}`
            : null,
          technologies,
          liveUrl,
          repositoryUrl,
          startDate,
          completionDate,
          status,
          memberRole,
          projectType,
          mainFeatures,
          isFeatured,
          displayOrder,
        }),
      ),
    };
  }

  async getOrganizationProfile(organizationId: string, publicId: string) {
    const profile = await this.profiles.findOne({
      where: { organizationId, publicId },
    });
    if (!profile) throw new NotFoundException('Developer profile not found.');
    const membership = await this.memberships.findOne({
      where: { organizationId, userId: profile.userId },
      select: { id: true },
    });
    if (!membership)
      throw new NotFoundException('Developer profile not found.');
    const [skills, experiences, education, certifications, projects] =
      await Promise.all([
        this.skills.find({
          where: { profileId: profile.id },
          order: { kind: 'ASC', name: 'ASC' },
        }),
        this.experiences.find({
          where: { profileId: profile.id },
          order: { startDate: 'DESC' },
        }),
        this.education.find({
          where: { profileId: profile.id },
          order: { startDate: 'DESC' },
        }),
        this.certifications.find({
          where: { profileId: profile.id },
          order: { issueDate: 'DESC' },
        }),
        this.projects.find({
          where: { profileId: profile.id },
          order: { isFeatured: 'DESC', displayOrder: 'ASC' },
        }),
      ]);
    return {
      publicId: profile.publicId,
      displayName: profile.displayName,
      title: profile.title,
      biography: profile.biography,
      location: profile.location,
      availability: profile.availability,
      githubUrl: profile.githubUrl,
      linkedinUrl: profile.linkedinUrl,
      websiteUrl: profile.websiteUrl,
      skills,
      experiences,
      education,
      certifications: certifications.map((item) => ({
        id: item.id,
        name: item.name,
        issuingInstitution: item.issuingInstitution,
        issueDate: item.issueDate,
        expirationDate: item.expirationDate,
        credentialUrl: item.credentialUrl,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      projects: projects.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        problemSolved: item.problemSolved,
        technologies: item.technologies,
        liveUrl: item.liveUrl,
        repositoryUrl: item.repositoryUrl,
        startDate: item.startDate,
        completionDate: item.completionDate,
        status: item.status,
        memberRole: item.memberRole,
        projectType: item.projectType,
        mainFeatures: item.mainFeatures,
        isFeatured: item.isFeatured,
        displayOrder: item.displayOrder,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  private async findOwnedRecord<T extends { id: string; profileId: string }>(
    repository: Repository<T>,
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<T> {
    const profile = await this.requireOwnProfile(organizationId, userId);
    const record = await repository.findOne({
      where: { id, profileId: profile.id } as never,
    });
    if (!record) throw new NotFoundException('Developer record not found.');
    return record;
  }

  private async removeOwnedRecord<T extends { id: string; profileId: string }>(
    repository: Repository<T>,
    organizationId: string,
    userId: string,
    id: string,
  ) {
    const record = await this.findOwnedRecord(
      repository,
      organizationId,
      userId,
      id,
    );
    await repository.remove(record);
    return { success: true };
  }

  private validateDates(start?: string | null, end?: string | null) {
    if (start && end && end < start) {
      throw new BadRequestException(
        'The end date must be on or after the start date.',
      );
    }
  }

  private async requireOwnProfile(organizationId: string, userId: string) {
    const profile = await this.profiles.findOne({
      where: { organizationId, userId },
    });
    if (!profile) throw new NotFoundException('Developer profile not found.');
    return profile;
  }
}
