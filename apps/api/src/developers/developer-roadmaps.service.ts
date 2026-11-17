import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperProfile } from './developer-profile.entity.js';
import { DeveloperRoadmap } from './developer-roadmap.entity.js';

type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  resourceUrl?: string;
};

@Injectable()
export class DeveloperRoadmapsService {
  constructor(
    @InjectRepository(DeveloperProfile)
    private readonly profiles: Repository<DeveloperProfile>,
    @InjectRepository(DeveloperRoadmap)
    private readonly roadmaps: Repository<DeveloperRoadmap>,
  ) {}

  private async profile(organizationId: string, userId: string) {
    const profile = await this.profiles.findOne({
      where: { organizationId, userId },
      select: { id: true },
    });
    if (!profile)
      throw new NotFoundException('Create your developer profile first.');
    return profile;
  }
  async list(organizationId: string, userId: string) {
    const profile = await this.profile(organizationId, userId);
    return this.roadmaps.find({
      where: { profileId: profile.id },
      order: { updatedAt: 'DESC' },
    });
  }
  async create(organizationId: string, userId: string, goal: unknown) {
    const profile = await this.profile(organizationId, userId);
    if (typeof goal !== 'string' || !goal.trim() || goal.trim().length > 160)
      throw new BadRequestException('Goal must contain 1 to 160 characters.');
    return this.roadmaps.save(
      this.roadmaps.create({
        profileId: profile.id,
        goal: goal.trim(),
        items: [],
      }),
    );
  }
  async update(
    organizationId: string,
    userId: string,
    id: string,
    goal: unknown,
    items: unknown,
  ) {
    const profile = await this.profile(organizationId, userId);
    const roadmap = await this.roadmaps.findOne({
      where: { id, profileId: profile.id },
    });
    if (!roadmap) throw new NotFoundException('Roadmap not found.');
    if (
      typeof goal !== 'string' ||
      !goal.trim() ||
      goal.trim().length > 160 ||
      !Array.isArray(items) ||
      items.length > 100
    )
      throw new BadRequestException('Invalid roadmap data.');
    const clean: RoadmapItem[] = items.map((item: unknown) => {
      if (typeof item !== 'object' || item === null)
        throw new BadRequestException('Invalid roadmap item.');
      const value = item as Record<string, unknown>;
      if (
        typeof value.id !== 'string' ||
        value.id.length > 80 ||
        typeof value.title !== 'string' ||
        !value.title.trim() ||
        value.title.length > 160 ||
        typeof value.description !== 'string' ||
        value.description.length > 2000 ||
        typeof value.completed !== 'boolean'
      )
        throw new BadRequestException('Invalid roadmap item.');
      let resourceUrl: string | undefined;
      if (value.resourceUrl !== undefined && value.resourceUrl !== '') {
        if (
          typeof value.resourceUrl !== 'string' ||
          value.resourceUrl.length > 2048
        )
          throw new BadRequestException('Invalid resource URL.');
        try {
          const url = new URL(value.resourceUrl);
          if (url.protocol !== 'https:') throw new Error();
          resourceUrl = url.toString();
        } catch {
          throw new BadRequestException('Resource URLs must use HTTPS.');
        }
      }
      return {
        id: value.id,
        title: value.title.trim(),
        description: value.description.trim(),
        completed: value.completed,
        ...(resourceUrl ? { resourceUrl } : {}),
      };
    });
    roadmap.goal = goal.trim();
    roadmap.items = clean;
    return this.roadmaps.save(roadmap);
  }
  async remove(organizationId: string, userId: string, id: string) {
    const profile = await this.profile(organizationId, userId);
    const result = await this.roadmaps.delete({ id, profileId: profile.id });
    if (!result.affected) throw new NotFoundException('Roadmap not found.');
    return { success: true };
  }
}
