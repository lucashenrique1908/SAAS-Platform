import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/organization.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { DeveloperCertification } from './developer-certification.entity.js';
import {
  DeveloperFile,
  type DeveloperFilePurpose,
} from './developer-file.entity.js';
import { DeveloperProfile } from './developer-profile.entity.js';
import { DeveloperProject } from './developer-project.entity.js';
import {
  DEVELOPER_FILE_STORAGE,
  type DeveloperFileStorage,
} from './developer-file-storage.js';

export type BufferedDeveloperUpload = {
  buffer: Buffer;
  originalname: string;
  size: number;
};

type DetectedType = { mimeType: string; extension: string };

@Injectable()
export class DeveloperFilesService {
  constructor(
    @Inject(DEVELOPER_FILE_STORAGE)
    private readonly storage: DeveloperFileStorage,
    @InjectRepository(DeveloperFile)
    private readonly files: Repository<DeveloperFile>,
    @InjectRepository(DeveloperProfile)
    private readonly profiles: Repository<DeveloperProfile>,
    @InjectRepository(DeveloperProject)
    private readonly projects: Repository<DeveloperProject>,
    @InjectRepository(DeveloperCertification)
    private readonly certifications: Repository<DeveloperCertification>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
  ) {}

  async uploadProfilePhoto(
    organizationId: string,
    userId: string,
    upload: BufferedDeveloperUpload,
  ) {
    const profile = await this.ownProfile(organizationId, userId);
    const file = await this.store(profile, userId, 'profile_photo', upload);
    const oldId = profile.photoFileId;
    profile.photoFileId = file.id;
    try {
      await this.profiles.save(profile);
      if (oldId) await this.deleteOwnedFile(oldId, userId);
    } catch (error) {
      await this.removeStoredFile(file);
      throw error;
    }
    return {
      fileId: file.id,
      url: `/api/developers/${profile.publicId}/files/${file.id}`,
    };
  }

  async uploadProjectCover(
    organizationId: string,
    userId: string,
    projectId: string,
    upload: BufferedDeveloperUpload,
  ) {
    const profile = await this.ownProfile(organizationId, userId);
    const project = await this.projects.findOne({
      where: { id: projectId, profileId: profile.id },
    });
    if (!project) throw new NotFoundException('Project not found.');
    const file = await this.store(profile, userId, 'project_cover', upload);
    const oldId = project.coverFileId;
    project.coverFileId = file.id;
    try {
      await this.projects.save(project);
      if (oldId) await this.deleteOwnedFile(oldId, userId);
    } catch (error) {
      await this.removeStoredFile(file);
      throw error;
    }
    return {
      fileId: file.id,
      url: `/api/developers/${profile.publicId}/files/${file.id}`,
    };
  }

  async uploadCertificate(
    organizationId: string,
    userId: string,
    certificationId: string,
    upload: BufferedDeveloperUpload,
  ) {
    const profile = await this.ownProfile(organizationId, userId);
    const certification = await this.certifications.findOne({
      where: { id: certificationId, profileId: profile.id },
    });
    if (!certification) throw new NotFoundException('Certification not found.');
    const file = await this.store(profile, userId, 'certificate', upload);
    const oldId = certification.certificateFileId;
    certification.certificateFileId = file.id;
    try {
      await this.certifications.save(certification);
      if (oldId) await this.deleteOwnedFile(oldId, userId);
    } catch (error) {
      await this.removeStoredFile(file);
      throw error;
    }
    return { fileId: file.id };
  }

  async getOrganizationFile(
    organizationId: string,
    userId: string,
    fileId: string,
  ) {
    const file = await this.files.findOne({
      where: { id: fileId, organizationId },
    });
    if (!file) throw new NotFoundException('File not found.');
    if (file.ownerUserId !== userId)
      throw new ForbiddenException('This file is private.');
    return this.fileResponse(file);
  }

  async getPublicFile(publicId: string, fileId: string) {
    const profile = await this.profiles.findOne({
      where: { publicId, isPublic: true },
    });
    if (!profile) throw new NotFoundException('File not found.');
    const publicFields = new Set(profile.publicFields ?? []);
    if (
      (fileId === profile.photoFileId && !publicFields.has('photo')) ||
      (fileId !== profile.photoFileId && !publicFields.has('projects'))
    ) {
      throw new NotFoundException('File not found.');
    }
    const [organization, membership, file] = await Promise.all([
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
      this.files.findOne({
        where: {
          id: fileId,
          profileId: profile.id,
          organizationId: profile.organizationId,
        },
      }),
    ]);
    if (!organization || !membership || !file)
      throw new NotFoundException('File not found.');
    const project =
      file.purpose === 'project_cover'
        ? await this.projects.findOne({
            where: {
              coverFileId: file.id,
              profileId: profile.id,
              isPublic: true,
            },
            select: { id: true },
          })
        : null;
    const profilePhoto =
      file.purpose === 'profile_photo' && profile.photoFileId === file.id;
    if (file.purpose === 'certificate' || (!profilePhoto && !project)) {
      throw new NotFoundException('File not found.');
    }
    return this.fileResponse(file);
  }

  async deleteFile(organizationId: string, userId: string, fileId: string) {
    const file = await this.files.findOne({
      where: { id: fileId, organizationId, ownerUserId: userId },
    });
    if (!file) throw new NotFoundException('File not found.');
    await this.removeStoredFile(file);
    return { success: true };
  }

  private async ownProfile(organizationId: string, userId: string) {
    const profile = await this.profiles.findOne({
      where: { organizationId, userId },
    });
    if (!profile) throw new NotFoundException('Developer profile not found.');
    return profile;
  }

  private async store(
    profile: DeveloperProfile,
    userId: string,
    purpose: DeveloperFilePurpose,
    upload: BufferedDeveloperUpload,
  ) {
    if (!upload?.buffer?.length)
      throw new BadRequestException('A file is required.');
    const max =
      purpose === 'profile_photo'
        ? 5 * 1024 * 1024
        : purpose === 'project_cover'
          ? 8 * 1024 * 1024
          : 10 * 1024 * 1024;
    if (upload.buffer.length > max)
      throw new BadRequestException('The file exceeds the allowed size.');
    const detected = this.detectType(upload.buffer);
    if (purpose === 'profile_photo' && !detected.mimeType.startsWith('image/'))
      throw new BadRequestException(
        'Profile photos must be PNG, JPEG, or WebP images.',
      );
    if (purpose === 'project_cover' && !detected.mimeType.startsWith('image/'))
      throw new BadRequestException(
        'Project covers must be PNG, JPEG, or WebP images.',
      );
    const originalName =
      Array.from(basename(upload.originalname || 'upload'))
        .filter((character) => character.charCodeAt(0) >= 0x20)
        .join('')
        .slice(0, 180) || 'upload';
    const file = await this.files.save(
      this.files.create({
        organizationId: profile.organizationId,
        profileId: profile.id,
        ownerUserId: userId,
        purpose,
        storageKey: `${randomUUID()}${detected.extension}`,
        originalName,
        mimeType: detected.mimeType,
        sizeBytes: upload.buffer.length,
      }),
    );
    try {
      await this.storage.put(file.storageKey, upload.buffer);
    } catch (error) {
      await this.files.delete({ id: file.id });
      throw error;
    }
    return file;
  }

  private detectType(buffer: Buffer): DetectedType {
    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return { mimeType: 'image/png', extension: '.png' };
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    )
      return { mimeType: 'image/jpeg', extension: '.jpg' };
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    )
      return { mimeType: 'image/webp', extension: '.webp' };
    if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-')
      return { mimeType: 'application/pdf', extension: '.pdf' };
    throw new BadRequestException('Unsupported file type.');
  }

  private async fileResponse(file: DeveloperFile) {
    let buffer: Buffer;
    try {
      buffer = await this.storage.get(file.storageKey);
    } catch {
      throw new NotFoundException('File not found.');
    }
    return {
      buffer,
      mimeType: file.mimeType,
      originalName: file.originalName,
      purpose: file.purpose,
    };
  }

  private async deleteOwnedFile(id: string, userId: string) {
    const file = await this.files.findOne({
      where: { id, ownerUserId: userId },
    });
    if (file) await this.removeStoredFile(file);
  }

  private async removeStoredFile(file: DeveloperFile) {
    await this.storage.remove(file.storageKey).catch(() => undefined);
    await this.files.delete({ id: file.id });
  }
}
