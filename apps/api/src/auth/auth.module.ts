import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthActionToken } from './auth-action-token.entity.js';
import { TransactionalEmailService } from './transactional-email.service.js';
import { AuthSession } from '../sessions/auth-session.entity.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { User } from '../users/user.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthActionToken,
      AuthSession,
      Organization,
      OrganizationMembership,
      User,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    SessionsService,
    TransactionalEmailService,
  ],
  exports: [AuthService, SessionAuthGuard, SessionsService],
})
export class AuthModule {}
