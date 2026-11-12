import { ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { hashOpaqueToken } from './../src/auth/auth-token.utils.js';
import { TransactionalEmailService } from './../src/auth/transactional-email.service.js';
import { OrganizationMembership } from './../src/organizations/organization-membership.entity.js';

const trustedOrigin = 'http://localhost:3000';
const validPassword = 'correct horse battery staple';

describe('Authentication and authorization (e2e)', () => {
  let app: import('@nestjs/common').INestApplication<App>;
  let dataSource: DataSource;
  const deliveredTokens = {
    verification: [] as string[],
    reset: [] as string[],
  };
  let shouldFailEmailDelivery = false;

  const emailProvider = {
    sendVerificationEmail: vi.fn(async (_email: string, token: string) => {
      if (shouldFailEmailDelivery) {
        throw new ServiceUnavailableException('simulated provider outage');
      }
      deliveredTokens.verification.push(token);
    }),
    sendPasswordResetEmail: vi.fn(async (_email: string, token: string) => {
      if (shouldFailEmailDelivery) {
        throw new ServiceUnavailableException('simulated provider outage');
      }
      deliveredTokens.reset.push(token);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TransactionalEmailService)
      .useValue(emailProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    shouldFailEmailDelivery = false;
    deliveredTokens.verification.length = 0;
    deliveredTokens.reset.length = 0;
    emailProvider.sendVerificationEmail.mockClear();
    emailProvider.sendPasswordResetEmail.mockClear();
    await dataSource.query(
      'TRUNCATE "auth_action_tokens", "auth_sessions", "organization_memberships", "organizations", "users" CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  function withCsrf<T extends { set: (name: string, value: string) => T }>(
    requestBuilder: T,
  ): T {
    return requestBuilder
      .set('Origin', trustedOrigin)
      .set('X-CSRF-Protection', '1');
  }

  async function register(email: string, password = validPassword) {
    return withCsrf(request(app.getHttpServer()).post('/auth/register')).send({
      email,
      password,
      organizationName: 'Example Workspace',
    });
  }

  async function verify(token: string) {
    return withCsrf(
      request(app.getHttpServer()).post('/auth/verify-email'),
    ).send({
      token,
    });
  }

  async function createVerifiedUser(email: string) {
    await register(email);
    const token = deliveredTokens.verification.at(-1);
    expect(token).toBeDefined();
    await verify(token!);
    const agent = request.agent(app.getHttpServer());
    const login = await withCsrf(agent.post('/auth/login')).send({
      email,
      password: validPassword,
    });
    expect(login.status).toBe(200);
    return agent;
  }

  it('keeps the existing root endpoint public', async () => {
    await request(app.getHttpServer()).get('/').expect(200, 'Hello World!');
  });

  it('registers users with a hashed password and neutral duplicate responses', async () => {
    const response = await register('NEW.User@example.test');
    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      message:
        'If the address is eligible, instructions will be sent by email.',
    });
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(emailProvider.sendVerificationEmail).toHaveBeenCalledOnce();

    const users = await dataSource.query(
      'SELECT email, password_hash, platform_role FROM users WHERE email = $1',
      ['new.user@example.test'],
    );
    expect(users[0].email).toBe('new.user@example.test');
    expect(users[0].password_hash).not.toBe(validPassword);
    expect(users[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(users[0].password_hash).not.toBe(deliveredTokens.verification[0]);
    expect(users[0].platform_role).toBe('none');

    const duplicate = await register('new.user@example.test');
    expect(duplicate.status).toBe(202);
    expect(duplicate.body).toEqual(response.body);
    expect(emailProvider.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('rejects invalid registration data and untrusted browser origins', async () => {
    const invalid = await withCsrf(
      request(app.getHttpServer()).post('/auth/register'),
    ).send({
      email: 'not-an-email',
      password: 'short',
      organizationName: 'A',
      platformRole: 'platform_admin',
    });
    expect(invalid.status).toBe(400);

    const untrusted = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'https://attacker.example')
      .set('X-CSRF-Protection', '1')
      .send({
        email: 'user@example.test',
        password: validPassword,
        organizationName: 'Workspace',
      });
    expect(untrusted.status).toBe(403);
  });

  it('requires valid, unexpired, single-use verification tokens', async () => {
    const registration = await register('verify@example.test');
    expect(registration.status).toBe(202);
    const token = deliveredTokens.verification[0]!;
    const stored = await dataSource.query(
      'SELECT token_hash FROM auth_action_tokens WHERE purpose = $1',
      ['email_verification'],
    );
    expect(stored[0].token_hash.trim()).toBe(hashOpaqueToken(token));
    expect(stored[0].token_hash.trim()).not.toBe(token);

    expect(
      (await verify('invalid-token-value-that-is-long-enough-123')).status,
    ).toBe(400);
    expect((await verify(token)).status).toBe(200);
    expect((await verify(token)).status).toBe(400);

    await register('expired-verification@example.test');
    const expiredToken = deliveredTokens.verification.at(-1)!;
    await dataSource.query(
      "UPDATE auth_action_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1",
      [hashOpaqueToken(expiredToken)],
    );
    expect((await verify(expiredToken)).status).toBe(400);
  });

  it('sets an HttpOnly cookie on login and protects profile access', async () => {
    await register('login@example.test');
    const unauthenticated = await withCsrf(
      request(app.getHttpServer()).post('/auth/login'),
    ).send({ email: 'login@example.test', password: validPassword });
    expect(unauthenticated.status).toBe(401);

    await verify(deliveredTokens.verification[0]!);
    const agent = request.agent(app.getHttpServer());
    const login = await withCsrf(agent.post('/auth/login')).send({
      email: 'LOGIN@example.test',
      password: validPassword,
    });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(login.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(login.body)).not.toContain('token');
    const rawSessionToken =
      login.headers['set-cookie'][0].match(/saas_session=([^;]+)/)?.[1];
    expect(rawSessionToken).toBeDefined();
    const storedSession = await dataSource.query(
      'SELECT token_hash FROM auth_sessions ORDER BY created_at DESC LIMIT 1',
    );
    expect(storedSession[0].token_hash.trim()).toBe(
      hashOpaqueToken(rawSessionToken!),
    );
    expect(storedSession[0].token_hash.trim()).not.toBe(rawSessionToken);

    const profile = await agent.get('/auth/me').expect(200);
    expect(profile.body.email).toBe('login@example.test');
    expect(profile.body.memberships).toHaveLength(1);
    expect(profile.body.memberships[0].role).toBe('owner');
    expect(profile.body).not.toHaveProperty('passwordHash');
  });

  it('rejects incorrect credentials without issuing a session', async () => {
    await createVerifiedUser('credentials@example.test');
    const invalid = await withCsrf(
      request(app.getHttpServer()).post('/auth/login'),
    ).send({
      email: 'credentials@example.test',
      password: 'incorrect password',
    });
    expect(invalid.status).toBe(401);
    expect(invalid.headers['set-cookie']).toBeUndefined();

    const unknown = await withCsrf(
      request(app.getHttpServer()).post('/auth/login'),
    ).send({ email: 'missing@example.test', password: validPassword });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(invalid.body);
  });

  it('rejects expired and revoked sessions and supports logout', async () => {
    const agent = request.agent(app.getHttpServer());
    await createVerifiedUser('session@example.test');
    const login = await withCsrf(agent.post('/auth/login')).send({
      email: 'session@example.test',
      password: validPassword,
    });
    expect(login.status).toBe(200);
    await agent.get('/auth/me').expect(200);

    const currentSession = await dataSource.query(
      'SELECT id FROM auth_sessions ORDER BY created_at DESC LIMIT 1',
    );
    await dataSource.query(
      "UPDATE auth_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1",
      [currentSession[0].id],
    );
    await agent.get('/auth/me').expect(401);

    const secondAgent = request.agent(app.getHttpServer());
    await withCsrf(secondAgent.post('/auth/login'))
      .send({ email: 'session@example.test', password: validPassword })
      .expect(200);
    const secondSession = await dataSource.query(
      'SELECT id FROM auth_sessions WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
    );
    await dataSource.query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1',
      [secondSession[0].id],
    );
    await secondAgent.get('/auth/me').expect(401);

    const logout = await withCsrf(agent.post('/auth/logout')).expect(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/saas_session=;/);
  });

  it('refreshes session activity and rejects sessions inactive for eight hours', async () => {
    const agent = await createVerifiedUser('idle-session@example.test');
    await agent.get('/auth/me').expect(200);
    const session = (
      await dataSource.query(
        'SELECT id FROM auth_sessions WHERE revoked_at IS NULL',
      )
    )[0];
    await dataSource.query(
      "UPDATE auth_sessions SET last_seen_at = NOW() - INTERVAL '7 hours 59 minutes' WHERE id = $1",
      [session.id],
    );

    await agent.get('/auth/me').expect(200);
    const refreshed = (
      await dataSource.query(
        'SELECT last_seen_at FROM auth_sessions WHERE id = $1',
        [session.id],
      )
    )[0];
    expect(new Date(refreshed.last_seen_at).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );

    await dataSource.query(
      "UPDATE auth_sessions SET last_seen_at = NOW() - INTERVAL '8 hours 1 minute' WHERE id = $1",
      [session.id],
    );
    await agent.get('/auth/me').expect(401);
  });

  it('does not enumerate recovery requests and resets the password while revoking sessions', async () => {
    const existing = await createVerifiedUser('recovery@example.test');
    const secondAgent = request.agent(app.getHttpServer());
    await withCsrf(secondAgent.post('/auth/login'))
      .send({ email: 'recovery@example.test', password: validPassword })
      .expect(200);

    const knownAccount = await withCsrf(
      request(app.getHttpServer()).post('/auth/forgot-password'),
    ).send({ email: 'recovery@example.test' });
    const unknownAccount = await withCsrf(
      request(app.getHttpServer()).post('/auth/forgot-password'),
    ).send({ email: 'missing@example.test' });
    expect(knownAccount.status).toBe(202);
    expect(unknownAccount.status).toBe(202);
    expect(knownAccount.body).toEqual(unknownAccount.body);
    const resetEndpoint = () =>
      withCsrf(request(app.getHttpServer()).post('/auth/reset-password'));
    expect(
      (
        await resetEndpoint().send({
          token: 'invalid-reset-token-that-is-long-enough-123',
          password: 'new secure password',
        })
      ).status,
    ).toBe(400);

    await withCsrf(request(app.getHttpServer()).post('/auth/forgot-password'))
      .send({ email: 'recovery@example.test' })
      .expect(202);
    const expiredToken = deliveredTokens.reset.at(-1)!;
    await dataSource.query(
      "UPDATE auth_action_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1",
      [hashOpaqueToken(expiredToken)],
    );
    expect(
      (
        await resetEndpoint().send({
          token: expiredToken,
          password: 'new secure password',
        })
      ).status,
    ).toBe(400);

    await withCsrf(request(app.getHttpServer()).post('/auth/forgot-password'))
      .send({ email: 'recovery@example.test' })
      .expect(202);
    const validResetToken = deliveredTokens.reset.at(-1)!;

    const oldSessions = await dataSource.query(
      'SELECT id FROM auth_sessions WHERE revoked_at IS NULL',
    );
    expect(oldSessions.length).toBeGreaterThanOrEqual(2);
    await withCsrf(request(app.getHttpServer()).post('/auth/reset-password'))
      .send({ token: validResetToken, password: 'another safe password' })
      .expect(200);
    expect(
      (
        await resetEndpoint().send({
          token: validResetToken,
          password: 'different secure password',
        })
      ).status,
    ).toBe(400);
    await existing.get('/auth/me').expect(401);
    await secondAgent.get('/auth/me').expect(401);
    await withCsrf(request(app.getHttpServer()).post('/auth/login'))
      .send({
        email: 'recovery@example.test',
        password: 'another safe password',
      })
      .expect(200);
  });

  it('lists and revokes only the authenticated user sessions', async () => {
    const first = request.agent(app.getHttpServer());
    await createVerifiedUser('session-list@example.test');
    await withCsrf(first.post('/auth/login'))
      .send({ email: 'session-list@example.test', password: validPassword })
      .expect(200);
    const current = await first.get('/auth/sessions').expect(200);
    expect(current.body).toHaveLength(2);
    expect(
      current.body.filter(
        (session: { isCurrent: boolean }) => session.isCurrent,
      ),
    ).toHaveLength(1);

    const other = await createVerifiedUser('other-session@example.test');
    const otherSessionId = (
      await dataSource.query(
        'SELECT id FROM auth_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
        ['other-session@example.test'],
      )
    )[0].id as string;
    await withCsrf(first.delete(`/auth/sessions/${otherSessionId}`)).expect(
      404,
    );

    const beforeLogoutAll = await first.get('/auth/sessions').expect(200);
    expect(beforeLogoutAll.body.length).toBeGreaterThan(0);
    const otherSession = current.body.find(
      (session: { isCurrent: boolean }) => !session.isCurrent,
    );
    expect(otherSession).toBeDefined();
    await withCsrf(first.delete(`/auth/sessions/${otherSession.id}`)).expect(
      204,
    );
    await first
      .get('/auth/sessions')
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(1));
    await withCsrf(first.post('/auth/logout-all')).expect(204);
    await first.get('/auth/me').expect(401);
    await other.get('/auth/me').expect(200);
  });

  it('isolates organization access by membership and role', async () => {
    const owner = await createVerifiedUser('owner@example.test');
    const ownerProfile = await owner.get('/auth/me').expect(200);
    const organizationId = ownerProfile.body.memberships[0]
      .organizationId as string;
    await owner.get(`/organizations/${organizationId}`).expect(200);

    const otherUser = await createVerifiedUser('outsider@example.test');
    await otherUser.get(`/organizations/${organizationId}`).expect(404);

    const membership = await dataSource
      .getRepository(OrganizationMembership)
      .findOne({
        where: { userId: ownerProfile.body.id, organizationId },
      });
    expect(membership?.role).toBe('owner');
  });

  it('handles email delivery outages without exposing recovery account existence', async () => {
    shouldFailEmailDelivery = true;
    const registration = await register('delivery-failure@example.test');
    expect(registration.status).toBe(202);
    expect(registration.body.message).toBe(
      'If the address is eligible, instructions will be sent by email.',
    );

    shouldFailEmailDelivery = false;
    await withCsrf(
      request(app.getHttpServer()).post('/auth/resend-verification'),
    )
      .send({ email: 'delivery-failure@example.test' })
      .expect(202);
    expect(deliveredTokens.verification).toHaveLength(1);

    await register('recovery-failure@example.test');
    await verify(deliveredTokens.verification[1]!);
    await register('resend-failure@example.test');
    shouldFailEmailDelivery = true;
    const resetRequest = await withCsrf(
      request(app.getHttpServer()).post('/auth/forgot-password'),
    ).send({ email: 'recovery-failure@example.test' });
    expect(resetRequest.status).toBe(202);
    expect(resetRequest.body.message).toBe(
      'If the address is eligible, instructions will be sent by email.',
    );
    const failedResend = await withCsrf(
      request(app.getHttpServer()).post('/auth/resend-verification'),
    ).send({ email: 'resend-failure@example.test' });
    const unknownResend = await withCsrf(
      request(app.getHttpServer()).post('/auth/resend-verification'),
    ).send({ email: 'missing@example.test' });
    expect(failedResend.status).toBe(202);
    expect(failedResend.body).toEqual(unknownResend.body);
    shouldFailEmailDelivery = false;
    await verify(deliveredTokens.verification[2]!).then((response) =>
      expect(response.status).toBe(200),
    );
  });
});
