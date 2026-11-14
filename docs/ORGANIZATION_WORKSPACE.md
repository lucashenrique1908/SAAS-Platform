# Organization and workspace management

## Data and access model

Organizations are tenants identified in URLs by a unique, normalized slug. The
UUID remains the stable database identity for memberships, module settings,
activity, invitations, and session context. Existing organizations receive a
unique slug when the workspace migration runs. Changing a slug changes the
workspace URL; foreign-key relationships continue to use the organization ID.

Each user can own or join any number of organizations. An organization
membership has one of the existing `owner`, `admin`, or `member` roles, plus a
separate list of module permissions. The API resolves the requested slug or
legacy UUID, requires an active organization and verifies the current user's
membership on every scoped request. The active workspace is also stored on the
server-side session as a convenience for the next visit; it is never used as
proof of authorization.

Owners have full organization control. Admins can edit the description, logo,
and contact information, invite or add Members, remove Members, and configure
modules. Members can read organization and member details, leave, and use only
modules for which they have `module:read` permission. The API enforces these
rules independently of the frontend.

## Onboarding and organization data

Registration creates a user and email-verification token only. After verifying
and signing in, a user with no active organization is directed to onboarding.
`POST /organizations` creates the organization, its Owner membership, module
settings, and the initial activity event in one transaction. The same endpoint
supports additional organizations.

Organization fields are `name`, `description`, `logoUrl`, `contactEmail`,
`phone`, `website`, `country`, `industry`, and `taxId`. Optional values may be
empty. URLs and contact email are validated; Portuguese tax numbers receive a
checksum validation when the country is Portugal. Logo values are HTTPS/HTTP
URLs; image uploads are outside this sprint.

Slugs are normalized with Unicode decomposition and punctuation handling.
Owner slug edits require `confirmSlugChange: true`; collisions return
alternatives, and `GET /organizations/slug-availability?slug=...` can check a
candidate before it is submitted. The stable organization UUID means existing
foreign keys remain consistent when the URL changes.

## Members, roles, and invitations

Owners and Admins can invite by email. Invitation tokens use 32 random bytes;
only their SHA-256 hashes are stored. Invitations expire after three days,
can be revoked while pending, and are accepted once by an active,
email-verified account whose normalized email matches the invitation. A
recipient without an account can register, verify the address, sign in, and
return to the invitation link. Direct addition is available for an existing,
verified account.

Admins can only add/invite Members and remove Members. Only Owners can promote
Members to Admin, appoint another Owner, change Admin roles, or remove Admins
and other Owners. Ownership transfer is transactional: the recipient becomes
Owner and the transferring Owner becomes Admin. Leaving, removal, or role
changes lock the organization row and reject removal/demotion of its last
Owner.

Membership permissions are restricted to `developer:read/write`,
`barber:read/write`, `hairdresser:read/write`, and `dentist:read/write`.
Owners and Admins have organization-wide module access; Members need an
explicit read permission. The current modules provide only starting pages,
not business functionality.

## Deactivation, deletion, and activity

Deactivation preserves organization data, records the state change, clears
active-organization pointers from sessions, and blocks all scoped access.
Only an Owner can reactivate it from the account's organization list.

Permanent deletion requires the exact organization name in the API request and
an explicit browser confirmation. The current schema cascades deletion to
memberships, invitations, module settings, and organization activity; session
references use `ON DELETE SET NULL`. No separate retention policy is defined
in the repository, and there are no organization business-data tables yet.
Future organization-scoped tables must define their retention and deletion
behavior before they are added.

The dashboard reads member and enabled-module counts from the database and
shows persisted events such as invitation, role, module, and organization
changes. Empty activity and notification states remain empty; no sample
metrics, activity, or notifications are fabricated.

## API surface

All endpoints below require the existing opaque session cookie and CSRF
protection for unsafe methods.

| Method     | Path                                               | Access                                              |
| ---------- | -------------------------------------------------- | --------------------------------------------------- |
| `GET`      | `/organizations`                                   | Signed-in user; list active memberships             |
| `POST`     | `/organizations`                                   | Verified user; create workspace and become Owner    |
| `GET`      | `/organizations/slug-availability?slug=...`        | Signed-in user                                      |
| `GET`      | `/organizations/:slug`                             | Active organization member; dashboard summary       |
| `POST`     | `/organizations/:slug/active`                      | Active organization member; persist session context |
| `PATCH`    | `/organizations/:slug`                             | Owner/Admin, with Owner-only name and slug          |
| `PATCH`    | `/organizations/:slug/deactivate`                  | Owner                                               |
| `PATCH`    | `/organizations/:slug/reactivate`                  | Owner, including while deactivated                  |
| `DELETE`   | `/organizations/:slug`                             | Owner; exact-name confirmation required             |
| `GET`      | `/organizations/:slug/members`                     | Active organization member                          |
| `POST`     | `/organizations/:slug/members`                     | Owner/Admin; direct verified account addition       |
| `PATCH`    | `/organizations/:slug/members/:userId/role`        | Owner                                               |
| `PATCH`    | `/organizations/:slug/members/:userId/permissions` | Owner/Admin (Admins manage Members only)            |
| `DELETE`   | `/organizations/:slug/members/:userId`             | Owner/Admin, subject to target role                 |
| `POST`     | `/organizations/:slug/members/me/leave`            | Active organization member                          |
| `POST`     | `/organizations/:slug/ownership/transfer`          | Owner                                               |
| `GET/POST` | `/organizations/:slug/invitations`                 | Owner/Admin                                         |
| `DELETE`   | `/organizations/:slug/invitations/:invitationId`   | Owner/Admin                                         |
| `POST`     | `/organizations/invitations/accept`                | Signed-in, verified account whose email matches     |
| `GET`      | `/organizations/:slug/modules`                     | Active organization member                          |
| `PATCH`    | `/organizations/:slug/modules`                     | Owner/Admin                                         |
| `GET`      | `/organizations/:slug/modules/:key`                | Active module with role/permission access           |

The Next.js application calls the API through `/api/organizations/*` route
handlers. It forwards the HttpOnly session cookie server-to-server and does
not store session tokens in browser JavaScript.

## Local validation

Use only the isolated test database on loopback port 5433. The test service
uses the Compose-only `saas_test` account and `saas_auth_test` database; it is
separate from the persistent development database on 5432.

```powershell
docker compose --profile test up -d postgres-test
$env:NODE_ENV = 'test'
$env:POSTGRES_HOST = '127.0.0.1'
$env:POSTGRES_PORT = '5433'
$env:POSTGRES_USER = 'saas_test'
$env:POSTGRES_PASSWORD = 'saas_test_password'
$env:POSTGRES_DB = 'saas_auth_test'
npm.cmd run migration:run --workspace=apps/api
npm.cmd run test:e2e
```

The E2E suite initializes and closes Nest automatically and replaces all
transactional email methods with in-memory mocks.
