import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuthSession } from './auth-session.entity.js';
import { User } from '../users/user.entity.js';
import {
  createOpaqueToken,
  hashOpaqueToken,
} from '../auth/auth-token.utils.js';

export const SESSION_COOKIE_NAME = 'saas_session';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
  ) {}

  async create(
    userId: string,
  ): Promise<{ session: AuthSession; token: string }> {
    const token = createOpaqueToken();
    const now = new Date();
    const session = this.sessions.create({
      userId,
      tokenHash: hashOpaqueToken(token),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      revokedAt: null,
    });
    await this.sessions.save(session);
    return { session, token };
  }

  async authenticate(
    token: string,
  ): Promise<{ session: AuthSession; user: User } | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashOpaqueToken(token) },
      relations: { user: true },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime() ||
      session.lastSeenAt.getTime() + SESSION_IDLE_TIMEOUT_MS <= now.getTime() ||
      !session.user.isActive ||
      !session.user.emailVerifiedAt
    ) {
      return null;
    }
    const updated = await this.sessions.update(
      {
        id: session.id,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
      { lastSeenAt: now },
    );
    if (!updated.affected) {
      return null;
    }
    session.lastSeenAt = now;
    return { session, user: session.user };
  }

  async revokeToken(token: string): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt: new Date() })
      .where('"token_hash" = :tokenHash AND "revoked_at" IS NULL', {
        tokenHash: hashOpaqueToken(token),
      })
      .execute();
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.sessions
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt: new Date() })
      .where(
        '"id" = :sessionId AND "user_id" = :userId AND "revoked_at" IS NULL',
        {
          sessionId,
          userId,
        },
      )
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt: new Date() })
      .where('"user_id" = :userId AND "revoked_at" IS NULL', { userId })
      .execute();
  }

  async list(userId: string, currentSessionId: string) {
    const sessions = await this.sessions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const now = Date.now();
    return sessions
      .filter(
        (session) => !session.revokedAt && session.expiresAt.getTime() > now,
      )
      .map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === currentSessionId,
      }));
  }
}
