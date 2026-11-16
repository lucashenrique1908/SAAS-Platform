# Developer module

## Architecture and records

The module is registered in the NestJS API and is exposed inside an organization workspace through the existing authenticated Next.js BFF. Developer data is stored in PostgreSQL using TypeORM. A profile is unique per member and organization; skills, experience, education, certifications, projects and roadmaps belong to that profile. Removing a membership hides organization and public profile access while retaining profile data. Rejoining the organization restores access subject to the member's current permissions.

The module requires the organization's Developer module to be enabled and a valid organization membership. Owner/Admin follow the workspace module policy; members need the `developer:read` or `developer:write` permission. Writes to a professional profile always require its owner. Public UUID routes return only selected profile fields and require both public visibility and an active organization membership.

Profiles include name, title, biography, photo, location, optional whole years of experience (0–80), availability and professional links. Education is optional. The profile years field is added by the reversible `1763400000000-DeveloperProfileYearsExperience` migration; the original core migration is left unchanged.

## API

All organization APIs are under `/organizations/:slug/developer` and use the existing session, CSRF and organization access middleware.

- `GET/PUT profile`, `GET/POST skills`, `PUT/DELETE skills/:id`
- CRUD collections: `experiences`, `education`, `certifications`, `projects`
- `GET search/members`, `GET search/projects`
- Profile and project uploads; owner-only file reads and public profile-photo/project-cover routes
- `GET/POST integrations`, provider connect/disconnect, GitHub public repository listing/import preview
- `POST cv/summary`, `GET/POST/PUT/DELETE roadmaps`, `POST roadmaps/generate`
- `GET jobs` using Adzuna when configured
- `GET/POST integrations/google_calendar/events`
- Public read-only profile: `/developers/:publicId`

## Visibility, uploads and privacy

New profiles default to public and can be made private. Public endpoints explicitly select safe fields; private certificates are never served publicly. Membership removal blocks public display and organization discovery but retains the records for a possible rejoin. Files are stored under `DEVELOPER_UPLOAD_DIR` with generated names, signature/size checks, path containment and owner/visibility checks. Local disk storage is intended for development; production needs a durable private storage adapter and backup/retention policy.

## Provider configuration

Add provider credentials only to the API runtime environment; never expose them to the browser. `.env.example` lists the variables; do not put real secrets there.

- `DEVELOPER_TOKEN_ENCRYPTION_KEY`: 32-byte base64 or hex key for AES-256-GCM token encryption.
- `API_PUBLIC_BASE_URL`: public API origin used to construct OAuth callback URLs.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: GitHub OAuth app. The integration requests `read:user` and lists only public repositories. Repository import is a preview; users confirm/save it through their project editor.
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`: LinkedIn OAuth/OIDC app with the provider-approved `openid profile email` product access. This imports identity only; work-history API access is not assumed and work history must be entered manually.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth web app with the exact API callback URI and Calendar event access. The scope is `calendar.events.owned`; events are read/created on the primary calendar. Credentials must be configured before connection can work.
- `OPENAI_API_KEY`, optional `OPENAI_MODEL`: server-side Responses API. CV summary and roadmap drafts send only the current user's profile facts, use `store: false`, enforce output bounds, and remain editable. Missing credentials disable generation while manual CV/roadmap workflows remain available.
- `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`: Adzuna API app credentials. Listings are live provider results; missing credentials produce an unavailable response and no sample jobs. Adzuna returns a description snippet, not necessarily a complete job description. Workplace labels are text matches, not verified provider fields. The UI provides a direct Adzuna search link when the API is unavailable.
- `ADZUNA_COMMERCIAL_LICENSE_CONFIRMED=true`, `ADZUNA_ATTRIBUTION_LOGO_URL`: required in production in addition to API credentials. Adzuna's current terms require a commercial licence after the evaluation period for use in a revenue-generating product, and require a linked Adzuna logo attribution at least 116×23 px. Configure the logo URL only after installing an approved official logo asset and obtaining the applicable licence. The API production gate stays closed without both values.

OAuth state is random, hashed in the database, bound to provider/user/organization, expires after ten minutes and is consumed once. Integration access and refresh tokens are encrypted at rest. Provider revocation is best effort; local credentials are deleted even when a provider is offline or a token has expired.

## Local setup and validation

Configure the environment and start the API and web workspaces using the root npm workspace scripts. Apply migrations only to a verified database after backing up any existing data. Never point test migrations at the development database. Targeted tests run with `npm.cmd exec --workspace=apps/api -- vitest run src/developers/developers.spec.ts`. Full project validation scripts are listed in the root `package.json`.

Known limitations: LinkedIn work-history import is unavailable without explicit approved API access; AI, Adzuna, Google Calendar and OAuth provider flows require operator credentials and registered redirect URLs. Adzuna production use additionally requires a commercial licence and logo asset configuration; workplace categories are inferred from text and can be inaccurate. Google Calendar events can be listed, created, retitled and deleted from the integrations page; roadmap milestones can be scheduled as events. PDF export uses the browser print dialog.
