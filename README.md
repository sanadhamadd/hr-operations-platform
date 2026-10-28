# HR Operations Platform

An HR knowledge and operations platform for employees and HR administrators.

**Status: early application foundation.** The repository currently contains a minimal Next.js
application with linting, formatting, type checking, a unit test and a CI workflow definition.
Authentication, the HR assistant, policy search, forms, the administrator portal and deployment are
not implemented yet.

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
