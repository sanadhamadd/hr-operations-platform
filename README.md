# HR Operations Platform

An HR knowledge and operations platform for employees and HR administrators.

**Status: early application foundation.** The repository contains a Next.js application with
employee and HR administration portal shells, invitation-only sign-in with Supabase Auth, role-based
access control enforced on the server and in PostgreSQL, a small design-token system, unit,
database and integration tests, and a CI workflow. Every portal page is a clearly labelled
placeholder that describes planned functionality. The HR assistant, policy search, forms,
approvals, people management, analytics and deployment are not implemented yet.

All demonstration content refers to Larkspur Works, a fictional organization.

## Routes

| Route                | Access                      | Status                                  |
| -------------------- | --------------------------- | --------------------------------------- |
| `/`                  | Public                      | Portal selection                        |
| `/login`             | Public                      | Email and password sign-in              |
| `/auth/set-password` | Invited user with a session | Choose a password after an invitation   |
| `/access-denied`     | Signed-in user              | Explains why access was refused         |
| `/chat`              | Active employee or HR admin | Placeholder                             |
| `/forms`             | Active employee or HR admin | Placeholder                             |
| `/requests`          | Active employee or HR admin | Placeholder                             |
| `/admin`             | Active HR administrator     | Redirects to `/admin/inbox`             |
| `/admin/inbox`       | Active HR administrator     | Placeholder                             |
| `/admin/people`      | Active HR administrator     | Placeholder                             |
| `/admin/questions`   | Active HR administrator     | Placeholder                             |
| `/admin/analytics`   | Active HR administrator     | Placeholder                             |
| `/api/session`       | Active employee or HR admin | The caller's own role and status (JSON) |
| `/api/admin/access`  | Active HR administrator     | Confirms HR access (JSON)               |

Visitors without a session are redirected to `/login`; API routes answer `401`. Signed-in users
without access to a page are redirected to `/access-denied`; API routes answer `403`.

## Authentication and authorization

- **Invitation only.** Public sign-up and anonymous sign-in are disabled in the Auth service
  (`supabase/config.toml`), not only hidden in the interface. Accounts are created with the
  provisioning command below.
- **Memberships decide access.** `app_private.memberships` records each account's role
  (`employee` or `hr_admin`) and status (`active` or `disabled`). It lives in a private schema that
  the database API does not expose. Signed-in users read only their own membership through
  `public.current_membership()`; memberships are written only through
  `public.provision_membership()`, which only the server-side secret key can call. Both functions
  run as dedicated non-login owner roles with forced row level security.
- **Checked on every request.** Pages, layouts and API routes call the server-side access layer in
  `src/lib/auth/session.ts`. It verifies the user with the Auth server and reads the membership
  from the database each time, so a role or status change applies to the next request even while
  an older session token is still valid. Roles in cookies, request headers, user metadata or JWT
  claims are never used.
- **Sessions** are kept in HttpOnly, SameSite=Lax cookies (Secure in production) and refreshed by
  `src/proxy.ts`, which also sends visitors without a session to `/login`. The proxy is not the
  authorization check.
- **No Supabase client or key in the browser.** Sign-in, sign-out and password changes are HTML
  forms handled by route handlers, which reject submissions from other sites. Redirect targets
  from requests are limited to paths on this site.
- **The secret key** is used only by `src/lib/auth/provisioning.ts`, which the application never
  imports.

## Project structure

- `src/app` – routes. Employee pages live in the `(employee)` route group; HR administration
  pages live under `admin`.
- `src/components/portal-shell` – the shared portal layout and navigation.
- `src/components/ui` – small shared UI primitives.
- `src/lib/navigation.ts` – portal navigation definitions.
- `src/lib/auth` – access decisions, the server-side access layer, redirect and request checks,
  and the provisioning command.
- `src/lib/supabase` – Supabase clients for server rendering and the proxy.
- `src/proxy.ts` – session refresh and sign-in redirects.
- `src/app/globals.css` – design tokens (colour, spacing, typography) with light and dark themes.
- `supabase/config.toml` – local Supabase configuration.
- `supabase/migrations` – versioned database migrations.
- `supabase/templates` – the invitation email.
- `supabase/tests/database` – database tests written with pgTAP.
- `tests/integration` – tests that run against the local Supabase services and a production build.

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm 11
- Docker Desktop, for the local Supabase services

## Getting started

```bash
npm ci
npm run supabase:start     # requires Docker
npm run db:migrate
cp .env.example .env.local # then fill in the keys shown by `npm run supabase:status`
npm run auth:provision -- create jordan.lee@example.com employee
npm run auth:provision -- create sam.rivera@example.com hr_admin
npm run dev
```

The development server runs at <http://127.0.0.1:3000>. The `create` command prints a generated
password for the local account.

### Provisioning accounts

```bash
npm run auth:provision -- invite <email> <employee|hr_admin>  # sends an invitation email
npm run auth:provision -- create <email> <employee|hr_admin>  # creates an account with a generated password
npm run auth:provision -- grant <email> <employee|hr_admin>   # sets the role and re-enables the account
npm run auth:provision -- disable <email>                     # disables the membership and blocks sign-in
```

Only synthetic `example.com` addresses are accepted. Invitation emails are captured by the local
email inbox at <http://127.0.0.1:54324>; nothing is sent externally.

## Commands

| Command                    | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `npm run dev`              | Start the local development server                           |
| `npm run build`            | Create a production build                                    |
| `npm run start`            | Serve the production build                                   |
| `npm run lint`             | Run ESLint                                                   |
| `npm run format`           | Format files with Prettier                                   |
| `npm run format:check`     | Check formatting without writing changes                     |
| `npm run typecheck`        | Generate Next.js route types and run the TypeScript check    |
| `npm test`                 | Run unit tests with Vitest                                   |
| `npm run test:integration` | Run integration tests (needs the local services and a build) |
| `npm run supabase:start`   | Start PostgreSQL, Auth, the database API and the email inbox |
| `npm run supabase:status`  | Show local service URLs and keys                             |
| `npm run db:start`         | Start only the local PostgreSQL database                     |
| `npm run db:migrate`       | Apply pending migrations to the local database               |
| `npm run db:test`          | Run the database tests against the local database            |
| `npm run db:stop`          | Stop the local Supabase containers (data is kept)            |
| `npm run auth:provision`   | Create, invite, re-enable or disable local accounts          |

## Local database

The Supabase CLI is installed as a pinned development dependency. `npm run supabase:start` starts
PostgreSQL (port 54322), Auth and the database API behind the API gateway (port 54321), and the
local email inbox (port 54324). Studio, Storage, Realtime, Edge Functions and analytics are not
started. `npm run db:start` starts only PostgreSQL. The first start downloads the required container
images. Everything runs locally; no hosted Supabase project is used.

`supabase/tests/database/auth-memberships.test.sql` checks the memberships migration: owner role
attributes, privileges, that the caller's identity is read exactly as `auth.uid()` reads it, and
the access employees, HR administrators, disabled accounts, accounts without a membership,
anonymous callers and the provisioning role each have.

`supabase/tests/database/authorization-feasibility.test.sql` checks the planned authorization
approach against the local database: separate non-login roles that own the tables and the
privileged functions, forced row level security, narrowly scoped `SECURITY DEFINER` functions,
explicit privileges, and positive and negative access checks that run as the non-privileged
`authenticated`, `anon` and owner roles. It uses a temporary synthetic schema and rolls back every
change.

## Continuous integration

`.github/workflows/ci.yml` runs three jobs. The first runs `npm ci`, linting, the formatting check,
type checking, unit tests and a production build. The second starts the local database, applies
the migrations and runs the database tests. The third starts the local Supabase services, builds
the application and runs the integration tests against `next start`.

## Telemetry

Next.js collects anonymous usage telemetry by default. To opt out locally, set
`NEXT_TELEMETRY_DISABLED=1` in your shell. The CI workflow sets it for every job.

The Supabase CLI also collects usage telemetry by default. Set `DO_NOT_TRACK=1` in your shell, or
run `npx supabase telemetry disable`, to opt out. The database and integration CI jobs set `DO_NOT_TRACK=1`.
