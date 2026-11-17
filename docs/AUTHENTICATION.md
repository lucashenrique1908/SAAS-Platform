# Authentication and authorization

Organization creation, management, invitations, slug routing, active workspace
context, module permissions, and the Workspace UI are documented in
[`ORGANIZATION_WORKSPACE.md`](./ORGANIZATION_WORKSPACE.md).

## Architecture

The NestJS API is the authority for authentication and authorization. The
Next.js application calls the API through same-origin route handlers under
`/api/auth` and `/api/organizations`; it does not store session tokens in
JavaScript or decide access based on client-side state.

The API uses TypeORM with PostgreSQL and explicit migrations. Schema
synchronization is disabled (`synchronize: false`). The API validates the
session cookie in `SessionAuthGuard`, checks request origins and the CSRF
header for unsafe methods in `CsrfGuard`, and applies a global throttler.

## Data model

- `User` stores a normalized, unique email, an Argon2id password hash, email
  verification state, and a platform role.
- `Organization` is a tenant with a unique workspace slug, contact details,
  active/deactivated state, module settings, invitations, and persisted
  organization activity.
- `OrganizationMembership` joins users and organizations, with an
  organization-specific role and module-permission list. A user can have
  memberships in multiple organizations.
- `AuthSession` stores a hash of the opaque session token, its creation and
  last-activity times, absolute expiry, and revocation time.
- `AuthActionToken` stores hashes of one-time email-verification and
  password-reset tokens with expiry and consumption state.

Users do not gain platform administrator privileges through registration.
Organization endpoints require an active membership for the requested slug
or legacy organization UUID; the API does not trust a route value or a client
permission list as proof of membership. Module access is checked against the
stored organization module state and membership permissions. Platform admin
privileges remain separate from organization roles.

## Registration and email verification

Registration validates an email and a 12–128 character password. It
lowercases and trims the email, hashes the password using Argon2id, and creates
the user and verification token in one database transaction. The token is
generated from 32 cryptographically random bytes; only its SHA-256 hash is
stored. The verification token expires after 24 hours and can be used once.
After email verification and sign-in, users without an active organization go
through onboarding. Organization creation then atomically creates the tenant,
its Owner membership, module settings, and an activity event.

The verification URL carries the action token in a URL fragment. The browser
reads the fragment, removes it from the visible URL, and posts the token to the
API. An unverified user cannot log in or authenticate a session. Verification
consumption and updating the user's verification timestamp occur in a
transaction while the token row is locked.

Registration and resend return the same generic accepted response to avoid
revealing whether an email is registered. If email delivery fails, the
registration remains a consistent, unverified account that can request a new
verification link. A failed resend does not invalidate previously issued
links. The resend and verification endpoints are rate-limited.

## Login and sessions

Login verifies the password with Argon2 and rejects missing, inactive, or
unverified accounts with a generic invalid-credentials response. A successful
login creates a random opaque session token and persists only its hash. The
raw token is sent only in the `saas_session` cookie; it is not returned in the
JSON response.

The cookie is `HttpOnly`, `SameSite=Lax`, path `/`, and has a seven-day
absolute lifetime. It is `Secure` in staging and production. Sessions expire
after eight hours without an authenticated request, or after the seven-day
absolute expiry, whichever comes first. Successful authenticated API requests
refresh `lastSeenAt`. Revoked, expired, inactive-user, and unverified-user
sessions are rejected.

The profile page loads profile and session data from the server and redirects
unauthenticated requests to `/login`. Users can revoke an individual session,
sign out the current session, or revoke all of their sessions. Logout is
idempotent for a stale cookie and clears it; unsafe requests still require the
CSRF/origin checks.

## Password recovery

Password-recovery requests return a generic accepted response whether or not
an eligible account exists. Reset tokens are random, stored only as hashes,
expire after one hour, and are consumed under a row lock. Resetting the
password validates the same 12–128 character length, stores an Argon2id hash,
consumes the token, and revokes all of the user's sessions in one transaction.
The reset page reads the token from the URL fragment and removes it from the
visible URL before submitting it.

## Authorization, CSRF, and rate limiting

Every non-public API request requires a valid server-side session. Organization
access is checked against the authenticated user and the membership for the
organization ID in the route. Missing membership is returned as not found;
insufficient roles or module permissions are forbidden.

Unsafe API requests must have an `Origin` that exactly matches one of the
configured `CORS_ORIGINS` and the `X-CSRF-Protection: 1` header. The BFF checks
same-origin browser requests and forwards the required headers. CORS is
configured with explicit origins and credentials; wildcard origins are not
accepted.

The NestJS throttler applies a process-local general limit of 60 requests per
minute and a limit of five requests per minute to registration, login,
verification, resend, and password recovery/reset endpoints. Tests use a
higher limit. Because the default throttler store is in memory, limits are
per-process and are not shared across replicas; deployments with multiple
instances should use shared throttler storage or an edge rate limiter.

## API endpoints

| Method   | Endpoint                    | Access                  | Purpose                                           |
| -------- | --------------------------- | ----------------------- | ------------------------------------------------- |
| `POST`   | `/auth/register`            | Public, rate-limited    | Register user and initial organization            |
| `POST`   | `/auth/resend-verification` | Public, rate-limited    | Request a verification link                       |
| `POST`   | `/auth/verify-email`        | Public, rate-limited    | Consume a verification token                      |
| `POST`   | `/auth/login`               | Public, rate-limited    | Create a session and set cookie                   |
| `POST`   | `/auth/logout`              | Public, CSRF-protected  | Revoke cookie session if present and clear cookie |
| `GET`    | `/auth/me`                  | Session                 | Return the authenticated profile                  |
| `GET`    | `/auth/sessions`            | Session                 | List the user's active sessions                   |
| `DELETE` | `/auth/sessions/:sessionId` | Session                 | Revoke one of the user's sessions                 |
| `POST`   | `/auth/logout-all`          | Session, CSRF-protected | Revoke all of the user's sessions                 |
| `POST`   | `/auth/forgot-password`     | Public, rate-limited    | Request a password-reset link                     |
| `POST`   | `/auth/reset-password`      | Public, rate-limited    | Consume a reset token and change password         |
| `GET`    | `/organizations/:slug`      | Session and membership  | Read an organization dashboard                    |
| `POST`   | `/organizations`            | Session, verified user  | Create an organization during onboarding          |

The browser uses same-origin BFF routes at `/api/auth/*` and
`/api/organizations/*`. The BFF forwards the session cookie
server-to-server and disables caching for authenticated responses.

## Environment and email

The root `.env.example` contains placeholders, not real credentials. Configure:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and
  `POSTGRES_DB` for PostgreSQL.
- `FRONTEND_BASE_URL` for verification and password-reset links.
- `CORS_ORIGINS` as a comma-separated list of exact frontend origins. Both
  values must use HTTPS in staging and production.
- `EMAIL_FROM` as `Name <email@domain>`.
- `RESEND_API_KEY` only in the server environment. It is optional in local and
  test environments and required in staging/production.
- `API_BASE_URL` for the server-side Next.js BFF to reach the API. It is not a
  `NEXT_PUBLIC_*` variable.

Configure a verified sender in Resend before sending real email. Unit and E2E
tests replace the email provider with an in-memory mock and require no Resend
credentials. In local development without an API key, delivery fails safely;
verification can be retried after configuring email.

## Local development and database

Copy `.env.example` to `.env`, set a local PostgreSQL password, and start the
local database:

```powershell
docker compose up -d postgres
npm.cmd run migration:run --workspace=apps/api
npm.cmd run start:dev --workspace=apps/api
npm.cmd run dev --workspace=apps/web
```

For E2E tests, start the separate Compose test service. It uses loopback port
5433, a database name ending in `_test`, test-only credentials, and a temporary
filesystem instead of the persistent development volume:

```powershell
docker compose --profile test up -d postgres-test
```

In another PowerShell terminal, configure the test-only connection and run
the migration and E2E tests. The E2E suite also runs outstanding migrations
when it starts:

```powershell
$env:NODE_ENV = 'test'
$env:POSTGRES_HOST = '127.0.0.1'
$env:POSTGRES_PORT = '5433'
$env:POSTGRES_USER = 'saas_test'
$env:POSTGRES_PASSWORD = 'saas_test_password'
$env:POSTGRES_DB = 'saas_auth_test'
$env:FRONTEND_BASE_URL = 'http://localhost:3000'
$env:CORS_ORIGINS = 'http://localhost:3000'
$env:EMAIL_FROM = 'SaaS Platform <auth@example.test>'
npm.cmd run migration:run --workspace=apps/api
npm.cmd run test:e2e --workspace=apps/api
```

Test mode rejects non-loopback database hosts and database names that do not
end in `_test`. The E2E suite truncates authentication tables in that database.
The `postgres-test` Compose service is isolated from the persistent development
volume and is disposable.

Run API and web unit tests, typechecks, lint, formatting checks, and builds
from the repository root with `npm.cmd test`, `npm.cmd run typecheck`,
`npm.cmd run lint`, `npm.cmd run format:check`, and `npm.cmd run build`.
Workspace-specific scripts are available in each app's `package.json`.

## Migrations

Authentication tables are created by the TypeORM migration in
`apps/api/src/database/migrations`. Migrations are explicit and reversible;
`synchronize` remains disabled. Run migrations only against the intended local
or disposable test database, never against a production or user-data database
as part of local verification.
