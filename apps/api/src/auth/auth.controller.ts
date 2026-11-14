import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { EmailDto } from './dto/email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { TokenDto } from './dto/token.dto.js';
import { Public } from './decorators/public.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  SessionsService,
} from '../sessions/sessions.service.js';
import { shouldLoadLocalEnvFile } from '../config/env.validation.js';

const AUTH_THROTTLE = {
  default: {
    limit: process.env.NODE_ENV === 'test' ? 1_000 : 5,
    ttl: 60_000,
  },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(AUTH_THROTTLE)
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(AUTH_THROTTLE)
  resendVerification(@Body() body: EmailDto) {
    return this.authService.resendVerification(body.email);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  verifyEmail(@Body() body: TokenDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    response.cookie(SESSION_COOKIE_NAME, result.token, this.cookieOptions());
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    await this.authService.logout(token);
    response.clearCookie(SESSION_COOKIE_NAME, this.clearCookieOptions());
  }

  @Get('me')
  getProfile(@Req() request: AuthenticatedRequest) {
    if (!request.authUser) {
      throw new BadRequestException('Authenticated user context is missing.');
    }
    return this.authService.getProfile(
      request.authUser.id,
      request.authSession?.activeOrganizationId,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(AUTH_THROTTLE)
  requestPasswordReset(@Body() body: EmailDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Get('sessions')
  listSessions(@Req() request: AuthenticatedRequest) {
    if (!request.authUser || !request.authSession) {
      throw new BadRequestException(
        'Authenticated session context is missing.',
      );
    }
    return this.sessionsService.list(
      request.authUser.id,
      request.authSession.id,
    );
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (!request.authUser || !request.authSession) {
      throw new BadRequestException(
        'Authenticated session context is missing.',
      );
    }
    const revoked = await this.sessionsService.revokeSession(
      request.authUser.id,
      sessionId,
    );
    if (!revoked) {
      throw new NotFoundException('Session not found.');
    }
    if (sessionId === request.authSession.id) {
      response.clearCookie(SESSION_COOKIE_NAME, this.clearCookieOptions());
    }
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (!request.authUser) {
      throw new BadRequestException('Authenticated user context is missing.');
    }
    await this.sessionsService.revokeAll(request.authUser.id);
    response.clearCookie(SESSION_COOKIE_NAME, this.clearCookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: !shouldLoadLocalEnvFile(this.config.get<string>('NODE_ENV')),
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_DURATION_MS,
    };
  }

  private clearCookieOptions() {
    return {
      httpOnly: true,
      secure: !shouldLoadLocalEnvFile(this.config.get<string>('NODE_ENV')),
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
