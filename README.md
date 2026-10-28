# HR Operations Platform

An HR knowledge and operations platform for employees and HR administrators.

**Status: early application foundation.** The repository currently contains a Next.js application
with navigable employee and HR administration portal shells, a small design-token system, unit
tests and a CI workflow definition. Every portal page is a clearly labelled placeholder that
describes planned functionality. Authentication, the HR assistant, policy search, forms, approvals,
analytics and deployment are not implemented yet.

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

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm 11

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

## Continuous integration

`.github/workflows/ci.yml` runs `npm ci`, linting, the formatting check, type checking, unit tests
and a production build.

## Telemetry

Next.js collects anonymous usage telemetry by default. To opt out locally, set
`NEXT_TELEMETRY_DISABLED=1` in your shell. The CI workflow sets it for every job.
