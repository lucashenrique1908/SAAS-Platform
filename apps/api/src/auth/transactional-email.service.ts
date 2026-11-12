import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const url = new URL('/verify-email', this.frontendBaseUrl());
    url.hash = new URLSearchParams({ token }).toString();
    await this.send(
      email,
      'Verify your SaaS Platform email',
      `<p>Confirm your email address to activate your account.</p><p><a href="${url.toString()}">Verify email</a></p>`,
      `Verify your email address: ${url.toString()}`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = new URL('/reset-password', this.frontendBaseUrl());
    url.hash = new URLSearchParams({ token }).toString();
    await this.send(
      email,
      'Reset your SaaS Platform password',
      `<p>A password reset was requested for your account.</p><p><a href="${url.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      `Reset your password: ${url.toString()}`,
    );
  }

  private frontendBaseUrl(): string {
    return this.config
      .getOrThrow<string>('FRONTEND_BASE_URL')
      .replace(/\/+$/, '');
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Transactional email delivery is not configured.',
      );
    }

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: this.config.getOrThrow<string>('EMAIL_FROM'),
        to,
        subject,
        html,
        text,
      });
      if (error) {
        throw new ServiceUnavailableException(
          'Transactional email delivery is temporarily unavailable.',
        );
      }
    } catch {
      this.logger.warn('Transactional email provider request failed.');
      throw new ServiceUnavailableException(
        'Transactional email delivery is temporarily unavailable.',
      );
    }
  }
}
