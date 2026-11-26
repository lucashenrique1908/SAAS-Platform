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
    invitations: [] as Array<{ email: string; token: string }>,
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
    sendOrganizationInvitationEmail: vi.fn(
      async (email: string, token: string) => {
        if (shouldFailEmailDelivery) {
          throw new ServiceUnavailableException('simulated provider outage');
        }
        deliveredTokens.invitations.push({ email, token });
      },
    ),
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
    deliveredTokens.invitations.length = 0;
    emailProvider.sendVerificationEmail.mockClear();
    emailProvider.sendPasswordResetEmail.mockClear();
    emailProvider.sendOrganizationInvitationEmail.mockClear();
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
    await withCsrf(agent.post('/organizations'))
      .send({ name: 'Example Workspace' })
      .expect(201);
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
    expect(profile.body.memberships).toHaveLength(0);
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
    const organizationSlug = ownerProfile.body.memberships[0]
      .organizationSlug as string;
    await owner.get(`/organizations/${organizationSlug}`).expect(200);

    const otherUser = await createVerifiedUser('outsider@example.test');
    await otherUser.get(`/organizations/${organizationSlug}`).expect(404);

    const membership = await dataSource
      .getRepository(OrganizationMembership)
      .findOne({
        where: {
          userId: ownerProfile.body.id,
          organizationId: ownerProfile.body.memberships[0].organizationId,
        },
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

  it('creates organizations during onboarding with unique normalized slugs', async () => {
    const owner = await createVerifiedUser('workspace-owner@example.test');
    const first = await withCsrf(owner.post('/organizations'))
      .send({
        name: 'Ação Café',
        country: 'PT',
        contactEmail: 'office@example.test',
      })
      .expect(201);
    expect(first.body.slug).toBe('acao-cafe');
    expect(first.body.contactEmail).toBe('office@example.test');

    const second = await withCsrf(owner.post('/organizations'))
      .send({ name: 'Ação Café' })
      .expect(201);
    expect(second.body.slug).toBe('acao-cafe-2');
    const profile = await owner.get('/auth/me').expect(200);
    expect(profile.body.memberships).toHaveLength(3);
    expect(
      profile.body.memberships.every(
        (item: { role: string }) => item.role === 'owner',
      ),
    ).toBe(true);
    const workspace = await owner
      .get(`/organizations/${first.body.slug}`)
      .expect(200);
    expect(workspace.body.membersCount).toBe(1);
    expect(
      workspace.body.activity.map((item: { type: string }) => item.type),
    ).toContain('organization.created');
  });

  it('requires explicit slug confirmation and prevents slug collisions', async () => {
    const owner = await createVerifiedUser('slug-owner@example.test');
    const created = await withCsrf(owner.post('/organizations'))
      .send({ name: 'Original Team' })
      .expect(201);
    await withCsrf(owner.patch(`/organizations/${created.body.slug}`))
      .send({ slug: 'next-team' })
      .expect(400);

    await withCsrf(owner.post('/organizations'))
      .send({ name: 'Next Team' })
      .expect(201);
    const collision = await withCsrf(
      owner.patch(`/organizations/${created.body.slug}`),
    )
      .send({ slug: 'next-team', confirmSlugChange: true })
      .expect(409);
    expect(collision.body.suggestions).toContain('next-team-2');

    const renamed = await withCsrf(
      owner.patch(`/organizations/${created.body.slug}`),
    )
      .send({
        name: 'Renamed Team',
        slug: 'renamed-team',
        confirmSlugChange: true,
      })
      .expect(200);
    expect(renamed.body.slug).toBe('renamed-team');
    await owner.get(`/organizations/${created.body.slug}`).expect(404);
    await owner.get('/organizations/renamed-team').expect(200);
  });

  it('enforces distinct Owner, Admin, and Member organization permissions', async () => {
    const owner = await createVerifiedUser('roles-owner@example.test');
    const admin = await createVerifiedUser('roles-admin@example.test');
    const member = await createVerifiedUser('roles-member@example.test');
    const ownerProfile = await owner.get('/auth/me').expect(200);
    const slug = ownerProfile.body.memberships[0].organizationSlug as string;
    const adminId = (await admin.get('/auth/me').expect(200)).body.id as string;
    const memberId = (await member.get('/auth/me').expect(200)).body
      .id as string;

    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'roles-admin@example.test', role: 'admin' })
      .expect(201);
    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'roles-member@example.test', role: 'member' })
      .expect(201);

    await withCsrf(admin.patch(`/organizations/${slug}`))
      .send({ description: 'Managed by an admin.' })
      .expect(200);
    await withCsrf(admin.patch(`/organizations/${slug}`))
      .send({ name: 'Unauthorized rename' })
      .expect(403);
    await withCsrf(admin.post(`/organizations/${slug}/invitations`))
      .send({ email: 'owner-role@example.test', role: 'owner' })
      .expect(403);
    await withCsrf(admin.post(`/organizations/${slug}/invitations`))
      .send({ email: 'admin-role@example.test', role: 'admin' })
      .expect(403);
    await withCsrf(
      admin.delete(`/organizations/${slug}/members/${adminId}`),
    ).expect(403);
    await withCsrf(
      admin.delete(`/organizations/${slug}/members/${memberId}`),
    ).expect(200);
    await withCsrf(
      owner.patch(`/organizations/${slug}/members/${adminId}/role`),
    )
      .send({ role: 'member' })
      .expect(200);
    await withCsrf(
      owner.patch(`/organizations/${slug}/members/${adminId}/permissions`),
    )
      .send({ permissions: ['developer:read'] })
      .expect(200);
  });

  it('stores invitations as hashes, binds acceptance to a verified email, and allows one use', async () => {
    const owner = await createVerifiedUser('invite-owner@example.test');
    const invitee = await createVerifiedUser('invitee@example.test');
    const unrelated = await createVerifiedUser('unrelated@example.test');
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    const invitation = await withCsrf(
      owner.post(`/organizations/${slug}/invitations`),
    )
      .send({ email: 'invitee@example.test', role: 'member' })
      .expect(201);
    const token = deliveredTokens.invitations.at(-1)!.token;
    expect(deliveredTokens.invitations.at(-1)!.email).toBe(
      'invitee@example.test',
    );
    const rows = await dataSource.query(
      'SELECT token_hash, expires_at, created_at FROM organization_invitations WHERE id = $1',
      [invitation.body.id],
    );
    expect(rows[0].token_hash.trim()).toBe(hashOpaqueToken(token));
    expect(rows[0].token_hash.trim()).not.toBe(token);
    expect(
      new Date(rows[0].expires_at).getTime() -
        new Date(rows[0].created_at).getTime(),
    ).toBeGreaterThan(71 * 60 * 60 * 1000);

    await withCsrf(unrelated.post('/organizations/invitations/accept'))
      .send({ token })
      .expect(403);
    const accepted = await withCsrf(
      invitee.post('/organizations/invitations/accept'),
    )
      .send({ token })
      .expect(201);
    expect(accepted.body.organization.slug).toBe(slug);
    await withCsrf(invitee.post('/organizations/invitations/accept'))
      .send({ token })
      .expect(400);
    const acceptedMember = await invitee
      .get(`/organizations/${slug}`)
      .expect(200);
    expect(acceptedMember.body.role).toBe('member');
  });

  it('expires and revokes invitations and rejects acceptance without verified email', async () => {
    const owner = await createVerifiedUser(
      'invite-lifecycle-owner@example.test',
    );
    const invitee = await createVerifiedUser(
      'invite-lifecycle-user@example.test',
    );
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    const expired = await withCsrf(
      owner.post(`/organizations/${slug}/invitations`),
    )
      .send({ email: 'invite-lifecycle-user@example.test', role: 'member' })
      .expect(201);
    const expiredToken = deliveredTokens.invitations.at(-1)!.token;
    await dataSource.query(
      "UPDATE organization_invitations SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1",
      [expired.body.id],
    );
    await withCsrf(invitee.post('/organizations/invitations/accept'))
      .send({ token: expiredToken })
      .expect(400);

    const revoked = await withCsrf(
      owner.post(`/organizations/${slug}/invitations`),
    )
      .send({ email: 'invite-lifecycle-user@example.test', role: 'member' })
      .expect(201);
    const revokedToken = deliveredTokens.invitations.at(-1)!.token;
    await withCsrf(
      owner.delete(`/organizations/${slug}/invitations/${revoked.body.id}`),
    ).expect(200);
    await withCsrf(invitee.post('/organizations/invitations/accept'))
      .send({ token: revokedToken })
      .expect(400);
  });

  it('transfers ownership transactionally and protects the last Owner', async () => {
    const owner = await createVerifiedUser('transfer-owner@example.test');
    const nextOwner = await createVerifiedUser('transfer-next@example.test');
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    const nextOwnerId = (await nextOwner.get('/auth/me').expect(200)).body
      .id as string;
    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'transfer-next@example.test', role: 'member' })
      .expect(201);
    await withCsrf(owner.post(`/organizations/${slug}/ownership/transfer`))
      .send({ userId: nextOwnerId })
      .expect(201);
    expect(
      (await owner.get(`/organizations/${slug}`).expect(200)).body.role,
    ).toBe('admin');
    expect(
      (await nextOwner.get(`/organizations/${slug}`).expect(200)).body.role,
    ).toBe('owner');
    await withCsrf(
      nextOwner.patch(`/organizations/${slug}/members/${nextOwnerId}/role`),
    )
      .send({ role: 'member' })
      .expect(409);
    await withCsrf(
      owner.post(`/organizations/${slug}/members/me/leave`),
    ).expect(200);

    const soleOwner = await createVerifiedUser('sole-owner@example.test');
    const soleSlug = (await soleOwner.get('/auth/me').expect(200)).body
      .memberships[0].organizationSlug as string;
    const soleId = (await soleOwner.get('/auth/me').expect(200)).body
      .id as string;
    await withCsrf(
      soleOwner.post(`/organizations/${soleSlug}/members/me/leave`),
    ).expect(409);
    await withCsrf(
      soleOwner.patch(`/organizations/${soleSlug}/members/${soleId}/role`),
    )
      .send({ role: 'member' })
      .expect(409);
  });

  it('checks module activation and per-member read permissions on the API', async () => {
    const owner = await createVerifiedUser('modules-owner@example.test');
    const member = await createVerifiedUser('modules-member@example.test');
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    const memberId = (await member.get('/auth/me').expect(200)).body
      .id as string;
    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'modules-member@example.test', role: 'member' })
      .expect(201);
    await member.get(`/organizations/${slug}/modules/dentist`).expect(404);
    await withCsrf(owner.patch(`/organizations/${slug}/modules`))
      .send({ key: 'dentist', enabled: true })
      .expect(200);
    await member.get(`/organizations/${slug}/modules/dentist`).expect(403);
    await withCsrf(
      owner.patch(`/organizations/${slug}/members/${memberId}/permissions`),
    )
      .send({ permissions: ['dentist:read'] })
      .expect(200);
    await member.get(`/organizations/${slug}/modules/dentist`).expect(200);
    await withCsrf(owner.patch(`/organizations/${slug}/modules`))
      .send({ key: 'dentist', enabled: false })
      .expect(200);
    await member.get(`/organizations/${slug}/modules/dentist`).expect(404);
  });

  it('enforces Barber activation, membership permissions, tenant isolation, and Owner-only professional deletion', async () => {
    const owner = await createVerifiedUser('barber-owner@example.test');
    const admin = await createVerifiedUser('barber-admin@example.test');
    const member = await createVerifiedUser('barber-member@example.test');
    const otherOwner = await createVerifiedUser(
      'barber-other-owner@example.test',
    );
    const ownerProfile = (await owner.get('/auth/me').expect(200)).body;
    const slug = ownerProfile.memberships[0].organizationSlug as string;
    const memberId = (await member.get('/auth/me').expect(200)).body
      .id as string;

    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'barber-admin@example.test', role: 'admin' })
      .expect(201);
    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'barber-member@example.test', role: 'member' })
      .expect(201);
    await withCsrf(
      owner.patch(`/organizations/${slug}/members/${memberId}/permissions`),
    )
      .send({ permissions: ['barber:read', 'barber:write'] })
      .expect(200);

    await owner.get(`/organizations/${slug}/barber/professionals`).expect(403);
    await withCsrf(owner.patch(`/organizations/${slug}/modules`))
      .send({ key: 'barber', enabled: true })
      .expect(200);
    await member.get(`/organizations/${slug}/barber/professionals`).expect(200);
    await otherOwner
      .get(`/organizations/${slug}/barber/professionals`)
      .expect(404);

    const professional = await withCsrf(
      owner.post(`/organizations/${slug}/barber/professionals`),
    )
      .send({ displayName: 'Alex Silva', userId: memberId })
      .expect(201);
    const editable = await member
      .get(`/organizations/${slug}/barber/professional-access`)
      .expect(200);
    expect(editable.body).toContain(professional.body.id);
    await member.get(`/organizations/${slug}/barber/professionals`).expect(200);
    await withCsrf(member.post(`/organizations/${slug}/barber/services`))
      .send({ name: 'Corte', priceCents: 1800, durationMinutes: 30 })
      .expect(403);

    await withCsrf(
      admin.delete(
        `/organizations/${slug}/barber/professionals/${professional.body.id}`,
      ),
    ).expect(403);
    await withCsrf(
      owner.delete(`/organizations/${slug}/members/${memberId}`),
    ).expect(200);
    const unlinked = await owner
      .get(`/organizations/${slug}/barber/professionals`)
      .expect(200);
    expect(
      unlinked.body.find(
        (item: { id: string }) => item.id === professional.body.id,
      ).userId,
    ).toBeNull();
    await withCsrf(
      owner.delete(
        `/organizations/${slug}/barber/professionals/${professional.body.id}`,
      ),
    ).expect(200);
  });

  it('scopes client operations to the responsible professional and preserves clients when the professional is deleted', async () => {
    const owner = await createVerifiedUser('barber-data-owner@example.test');
    const admin = await createVerifiedUser('barber-data-admin@example.test');
    const member = await createVerifiedUser('barber-data-member@example.test');
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    const memberId = (await member.get('/auth/me').expect(200)).body
      .id as string;
    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'barber-data-admin@example.test', role: 'admin' })
      .expect(201);
    await withCsrf(owner.post(`/organizations/${slug}/members`))
      .send({ email: 'barber-data-member@example.test', role: 'member' })
      .expect(201);
    await withCsrf(
      owner.patch(`/organizations/${slug}/members/${memberId}/permissions`),
    )
      .send({ permissions: ['barber:read', 'barber:write'] })
      .expect(200);
    await withCsrf(owner.patch(`/organizations/${slug}/modules`))
      .send({ key: 'barber', enabled: true })
      .expect(200);
    const professional = await withCsrf(
      owner.post(`/organizations/${slug}/barber/professionals`),
    )
      .send({ displayName: 'Alex Silva', userId: memberId })
      .expect(201);
    const service = await withCsrf(
      owner.post(`/organizations/${slug}/barber/services`),
    )
      .send({ name: 'Corte clássico', priceCents: 1800, durationMinutes: 30 })
      .expect(201);
    await withCsrf(
      owner.put(`/organizations/${slug}/barber/professional-services`),
    )
      .send({
        professionalId: professional.body.id,
        serviceId: service.body.id,
        enabled: true,
      })
      .expect(200);
    expect(
      (
        await admin
          .get(`/organizations/${slug}/barber/professional-services`)
          .expect(200)
      ).body,
    ).toHaveLength(1);

    const privateClient = await withCsrf(
      owner.post(`/organizations/${slug}/barber/clients`),
    )
      .send({ fullName: 'Joana Sousa', phone: '+351 910 000 010' })
      .expect(201);
    await withCsrf(member.post(`/organizations/${slug}/barber/clients`))
      .send({ fullName: 'Joana Sousa', phone: '+351 910 000 010' })
      .expect(201);
    const ownClients = await member
      .get(`/organizations/${slug}/barber/clients`)
      .expect(200);
    expect(ownClients.body).toHaveLength(1);
    await withCsrf(
      member.put(
        `/organizations/${slug}/barber/clients/${privateClient.body.id}`,
      ),
    )
      .send({ fullName: 'Acesso indevido', phone: '+351 910 000 011' })
      .expect(404);
    await withCsrf(
      admin.delete(
        `/organizations/${slug}/barber/professionals/${professional.body.id}`,
      ),
    ).expect(403);
    await withCsrf(
      owner.delete(
        `/organizations/${slug}/barber/professionals/${professional.body.id}`,
      ),
    ).expect(200);
    const preserved = await owner
      .get(`/organizations/${slug}/barber/clients`)
      .expect(200);
    expect(preserved.body).toHaveLength(2);
    expect(
      preserved.body.every(
        (item: { responsibleProfessionalId: string | null }) =>
          item.responsibleProfessionalId === null,
      ),
    ).toBe(true);
    expect(
      await dataSource.query(
        'SELECT id FROM barber_professional_services WHERE organization_id = (SELECT id FROM organizations WHERE slug = $1)',
        [slug],
      ),
    ).toHaveLength(0);
  });

  it('authenticates a customer without internal membership and exposes only that customer record', async () => {
    const owner = await createVerifiedUser(
      'barber-customer-owner@example.test',
    );
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    await register('barber-customer@example.test');
    await verify(deliveredTokens.verification.at(-1)!);
    const customer = request.agent(app.getHttpServer());
    await withCsrf(customer.post('/auth/login'))
      .send({ email: 'barber-customer@example.test', password: validPassword })
      .expect(200);
    expect(
      (await customer.get('/auth/me').expect(200)).body.memberships,
    ).toEqual([]);
    const customerId = (
      await dataSource.query('SELECT id FROM users WHERE email = $1', [
        'barber-customer@example.test',
      ])
    )[0].id as string;
    const organizationId = (
      await dataSource.query('SELECT id FROM organizations WHERE slug = $1', [
        slug,
      ])
    )[0].id as string;
    await dataSource.query(
      'INSERT INTO barber_clients (organization_id, user_id, full_name, phone) VALUES ($1, $2, $3, $4)',
      [organizationId, customerId, 'Cliente Teste', '+351 910 000 001'],
    );
    const customerData = await customer.get('/barber-customer/me').expect(200);
    expect(customerData.body).toEqual(
      expect.objectContaining({
        fullName: 'Cliente Teste',
        phone: '+351 910 000 001',
      }),
    );
    await customer.get(`/organizations/${slug}/barber/clients`).expect(404);
    const anotherCustomer = request.agent(app.getHttpServer());
    await register('barber-customer-other@example.test');
    await verify(deliveredTokens.verification.at(-1)!);
    await withCsrf(anotherCustomer.post('/auth/login'))
      .send({
        email: 'barber-customer-other@example.test',
        password: validPassword,
      })
      .expect(200);
    await anotherCustomer.get('/barber-customer/me').expect(404);
  });

  it('deactivates and reactivates organizations and requires explicit deletion confirmation', async () => {
    const owner = await createVerifiedUser('lifecycle-owner@example.test');
    const slug = (await owner.get('/auth/me').expect(200)).body.memberships[0]
      .organizationSlug as string;
    await withCsrf(owner.patch(`/organizations/${slug}/deactivate`)).expect(
      200,
    );
    await owner.get(`/organizations/${slug}`).expect(404);
    await withCsrf(owner.patch(`/organizations/${slug}/reactivate`)).expect(
      200,
    );
    await owner.get(`/organizations/${slug}`).expect(200);
    await withCsrf(owner.delete(`/organizations/${slug}`))
      .send({ confirmName: 'wrong name' })
      .expect(400);
    await withCsrf(owner.delete(`/organizations/${slug}`))
      .send({ confirmName: 'Example Workspace' })
      .expect(200);
    await owner.get(`/organizations/${slug}`).expect(404);
    const remaining = await dataSource.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [slug],
    );
    expect(remaining).toHaveLength(0);
  });
});
