# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres connection string), `CLERK_SECRET_KEY`,
  `CLERK_PUBLISHABLE_KEY`, and frontend `VITE_CLERK_PUBLISHABLE_KEY`.
- Set `ALTRIX_ADMIN_EMAIL` to the authorized administrator's verified email.
  In Clerk, set that user's server-managed public metadata to
  `{"altrixRole":"admin"}`. Admin access requires both checks; public patient
  registration cannot grant the metadata.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Language metadata is defined in `lib/db/src/schema/health.ts`; apply schema changes with `pnpm --filter @workspace/db run push`. The API idempotently upserts enabled language records and translation seeds. Locale codes and response contracts are defined in `lib/api-spec/openapi.yaml`.
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- Language API and translation seed data: `artifacts/api-server/src/routes/altrix.ts`
- Language selector and profile preference persistence: `artifacts/altrix-health/src/App.tsx`
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
