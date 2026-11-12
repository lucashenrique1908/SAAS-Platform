import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../auth.types.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (safeMethods.has(request.method)) {
      return true;
    }

    const allowedOrigins = this.config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim());
    const origin = request.get('origin');
    const csrfHeader = request.get('x-csrf-protection');

    if (!origin || !allowedOrigins.includes(origin) || csrfHeader !== '1') {
      throw new ForbiddenException('Request origin could not be verified.');
    }
    return true;
  }
}
