# HR Operations Platform

An HR knowledge and operations platform for employees and HR administrators.

**Status: early application foundation.** The repository currently contains a Next.js application
with navigable employee and HR administration portal shells, a small design-token system, unit
tests, a CI workflow definition and a local PostgreSQL database for development. Every portal page
is a clearly labelled placeholder that describes planned functionality. The application schema,
authentication, the HR assistant, policy search, forms, approvals, analytics and deployment are not
implemented yet.

All demonstration content refers to Larkspur Works, a fictional organization.

## Routes

| Route              | Portal            | Status                      |
| ------------------ | ----------------- | --------------------------- |
| `/`                | Portal selection  | Available                   |
| `/chat`            | Employee          | Placeholder                 |
| `/forms`           | Employee          | Placeholder                 |
| `/requests`        | Employee          | Placeholder                 |
| `/admin`           | HR administration | Redirects to `/admin/inbox` |
| `/admin/inbox`     | HR administration | Placeholder                 |
| `/admin/people`    | HR administration | Placeholder                 |
| `/admin/questions` | HR administration | Placeholder                 |
| `/admin/analytics` | HR administration | Placeholder                 |

Sign-in is not enabled yet, so both portals are openly reachable in this preview.

## Project structure

- `src/app` – routes. Employee pages live in the `(employee)` route group; HR administration
  pages live under `admin`.
- `src/components/portal-shell` – the shared portal layout and navigation.
- `src/components/ui` – small shared UI primitives.
- `src/lib/navigation.ts` – portal navigation definitions.
- `src/app/globals.css` – design tokens (colour, spacing, typography) with light and dark themes.
- `supabase/config.toml` – local Supabase configuration.
- `supabase/tests/database` – database tests written with pgTAP.

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm 11
- Docker Desktop, for the local database only

## Getting started

```bash
npm ci
npm run dev
```

The development server runs at <http://localhost:3000>.

No environment variables are required at this stage. `.env.example` lists placeholders as they
become necessary.

## Commands

| Command                | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Start the local development server                        |
| `npm run build`        | Create a production build                                 |
| `npm run start`        | Serve the production build                                |
| `npm run lint`         | Run ESLint                                                |
| `npm run format`       | Format files with Prettier                                |
| `npm run format:check` | Check formatting without writing changes                  |
| `npm run typecheck`    | Generate Next.js route types and run the TypeScript check |
| `npm test`             | Run unit tests with Vitest                                |
| `npm run db:start`     | Start the local PostgreSQL database (requires Docker)     |
| `npm run db:test`      | Run the database tests against the local database         |
| `npm run db:stop`      | Stop the local database containers                        |

## Local database

The Supabase CLI is installed as a pinned development dependency. `npm run db:start` starts only the
PostgreSQL container on port 54322; the other Supabase services are not started. The first start
downloads the required container images.

`supabase/tests/database/authorization-feasibility.test.sql` checks the planned authorization
approach against the local database: separate non-login roles that own the tables and the
privileged functions, forced row level security, narrowly scoped `SECURITY DEFINER` functions,
explicit privileges, and positive and negative access checks that run as the non-privileged
`authenticated`, `anon` and owner roles. It uses a temporary synthetic schema and rolls back every
change.

## Continuous integration

`.github/workflows/ci.yml` runs two jobs. The first runs `npm ci`, linting, the formatting check,
type checking, unit tests and a production build. The second starts the local database and runs the
database tests.

## Telemetry

Next.js collects anonymous usage telemetry by default. To opt out locally, set
`NEXT_TELEMETRY_DISABLED=1` in your shell. The CI workflow sets it for every job.

The Supabase CLI also collects usage telemetry by default. Set `DO_NOT_TRACK=1` in your shell, or
run `npx supabase telemetry disable`, to opt out. The database CI job sets `DO_NOT_TRACK=1`.
