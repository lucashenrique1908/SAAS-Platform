import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  AuthActionToken,
  type AuthActionTokenPurpose,
} from './auth-action-token.entity.js';
import { hashOpaqueToken } from './auth-token.utils.js';
import { TransactionalEmailService } from './transactional-email.service.js';
import { Organization } from '../organizations/organization.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { AuthSession } from '../sessions/auth-session.entity.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { User } from '../users/user.entity.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';

const VERIFICATION_TOKEN_DURATION_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_DURATION_MS = 60 * 60 * 1000;
const GENERIC_EMAIL_RESPONSE =
  'If the address is eligible, instructions will be sent by email.';
const INVALID_ACTION_TOKEN = 'The token is invalid or has expired.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyPasswordHash = argon2.hash(
    randomBytes(32).toString('hex'),
    { type: argon2.argon2id },
  );

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly sessionsService: SessionsService,
    private readonly emailService: TransactionalEmailService,
  ) {}

  async register(input: RegisterDto): Promise<{ message: string }> {
    const email = this.normalizeEmail(input.email);
    if (await this.users.findOne({ where: { email } })) {
      return { message: GENERIC_EMAIL_RESPONSE };
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const token = randomBytes(32).toString('base64url');
    try {
      await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const organizations = manager.getRepository(Organization);
        const memberships = manager.getRepository(OrganizationMembership);
        const user = await users.save(
          users.create({
            email,
            passwordHash,
            emailVerifiedAt: null,
            platformRole: 'none',
            isActive: true,
          }),
        );
        const organization = await organizations.save(
          organizations.create({ name: input.organizationName.trim() }),
        );
        await memberships.save(
          memberships.create({
            userId: user.id,
            organizationId: organization.id,
            role: 'owner',
            permissions: [],
          }),
        );
        await this.createActionToken(
          manager,
          user.id,
          'email_verification',
          token,
          VERIFICATION_TOKEN_DURATION_MS,
        );
        return user.id;
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.code === '23505'
      ) {
        return { message: GENERIC_EMAIL_RESPONSE };
      }
      throw error;
    }

    await this.sendVerificationEmail(email, token);
    return { message: GENERIC_EMAIL_RESPONSE };
  }

  async resendVerification(emailInput: string): Promise<{ message: string }> {
    const user = await this.users.findOne({
      where: { email: this.normalizeEmail(emailInput), isActive: true },
    });
    if (!user || user.emailVerifiedAt) {
      return { message: GENERIC_EMAIL_RESPONSE };
    }

    const token = randomBytes(32).toString('base64url');
    await this.dataSource.transaction((manager) =>
      this.createActionToken(
        manager,
        user.id,
        'email_verification',
        token,
        VERIFICATION_TOKEN_DURATION_MS,
        false,
      ),
    );
    const emailSent = await this.sendVerificationEmail(user.email, token);
    if (!emailSent) {
      await this.dataSource.transaction((manager) =>
        manager.getRepository(AuthActionToken).delete({
          userId: user.id,
          purpose: 'email_verification',
          tokenHash: hashOpaqueToken(token),
        }),
      );
    }
    return { message: GENERIC_EMAIL_RESPONSE };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    await this.dataSource.transaction(async (manager) => {
      const actionToken = await manager.getRepository(AuthActionToken).findOne({
        where: {
          tokenHash: hashOpaqueToken(token),
          purpose: 'email_verification',
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!actionToken) {
        throw new BadRequestException(INVALID_ACTION_TOKEN);
      }

      const user = await manager.getRepository(User).findOne({
        where: { id: actionToken.userId, isActive: true },
      });
      if (!user) {
        throw new BadRequestException(INVALID_ACTION_TOKEN);
      }

      actionToken.consumedAt = new Date();
      await manager.getRepository(AuthActionToken).save(actionToken);
      await manager.getRepository(User).update(actionToken.userId, {
        emailVerifiedAt: new Date(),
      });
    });
    return { message: 'Email verified.' };
  }

  async login(input: LoginDto): Promise<{
    token: string;
    session: AuthSession;
    user: Pick<User, 'id' | 'email' | 'emailVerifiedAt'>;
  }> {
    const email = this.normalizeEmail(input.email);
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
    const passwordHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordMatches = await argon2.verify(passwordHash, input.password);
    if (!user || !passwordMatches || !user.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const { token, session } = await this.sessionsService.create(user.id);
    return {
      token,
      session,
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async requestPasswordReset(emailInput: string): Promise<{ message: string }> {
    const user = await this.users.findOne({
      where: { email: this.normalizeEmail(emailInput), isActive: true },
    });
    if (!user || !user.emailVerifiedAt) {
      return { message: GENERIC_EMAIL_RESPONSE };
    }

    const token = randomBytes(32).toString('base64url');
    await this.dataSource.transaction((manager) =>
      this.createActionToken(
        manager,
        user.id,
        'password_reset',
        token,
        PASSWORD_RESET_TOKEN_DURATION_MS,
      ),
    );
    try {
      await this.emailService.sendPasswordResetEmail(user.email, token);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        throw error;
      }
      this.logger.error('Password recovery email delivery failed.');
    }
    return { message: GENERIC_EMAIL_RESPONSE };
  }

  async resetPassword(input: ResetPasswordDto): Promise<{ message: string }> {
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    await this.dataSource.transaction(async (manager) => {
      const token = await manager.getRepository(AuthActionToken).findOne({
        where: {
          tokenHash: hashOpaqueToken(input.token),
          purpose: 'password_reset',
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!token) {
        throw new BadRequestException(INVALID_ACTION_TOKEN);
      }

      token.consumedAt = new Date();
      await manager.getRepository(AuthActionToken).save(token);
      await manager.getRepository(User).update(token.userId, { passwordHash });
      await manager
        .getRepository(AuthSession)
        .createQueryBuilder()
        .update(AuthSession)
        .set({ revokedAt: new Date() })
        .where('"user_id" = :userId AND "revoked_at" IS NULL', {
          userId: token.userId,
        })
        .execute();
    });
    return { message: 'Password reset. Please sign in again.' };
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { memberships: { organization: true } },
    });
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      memberships: user.memberships.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        role: membership.role,
      })),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) {
      await this.sessionsService.revokeToken(token);
    }
  }

  private async createActionToken(
    manager: EntityManager,
    userId: string,
    purpose: AuthActionTokenPurpose,
    token: string,
    durationMs: number,
    replacePrevious = true,
  ): Promise<AuthActionToken> {
    const tokens = manager.getRepository(AuthActionToken);
    if (replacePrevious) {
      await tokens.delete({ userId, purpose });
    }
    const actionToken = tokens.create({
      userId,
      tokenHash: hashOpaqueToken(token),
      purpose,
      expiresAt: new Date(Date.now() + durationMs),
      consumedAt: null,
    });
    return tokens.save(actionToken);
  }

  private async sendVerificationEmail(
    email: string,
    token: string,
  ): Promise<boolean> {
    try {
      await this.emailService.sendVerificationEmail(email, token);
      return true;
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        throw error;
      }
      this.logger.warn('Verification email delivery failed.');
      return false;
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
