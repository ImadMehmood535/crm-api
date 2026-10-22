# Proposal: Platform foundation

## Why

The backend is being rebuilt spec-driven so that the existing frontend (`crm-developer-ui`) works
against it unchanged. Today the repo holds only an architecture guide written for a different
service: it uses BIGINT ids, PascalCase tables, no migrations, `{ statusCode, message, error }` errors
and no auth. That contradicts the frontend contract (`memory-bank/api-contract-v1.md`) and the
decisions taken on 2026-10-23. Every later change (auth, platform console, RBAC, hierarchy, branding,
inventory) needs one agreed foundation first.

## What Changes

- **BREAKING (docs):** rewrite `ARCHITECTURE.md` to the agreed conventions:
  - UUID v7 primary keys, snake_case tables and columns, `created_at`/`updated_at`.
  - Plain SQL migrations and seeds run by a small in-house runner, with `synchronize` off.
  - A transaction pattern.
  - The frontend response envelope and error codes, with 422 `VALIDATION_FAILED` listing every field.
  - `/api/v1` on port 3000, and `page`/`pageSize` pagination.
  - Multi-tenant scoping by `organization_id`, a join-table pattern, and request DTO validation with
    `class-validator`.
  - Libraries are allowed when a change justifies them.
- Scaffold the NestJS service:
  - Config module and Sequelize database module.
  - Migration and seed runner (`npm run db:migrate`, `npm run db:seed`).
  - Global response envelope interceptor, global exception filter and validation pipe.
  - `GET /health`.
  - `docker-compose.yml` (Postgres 16), plus ESLint, Prettier, Jest (unit, integration, e2e) and
    `scripts/check-boundaries.sh`.
- Shared kernel: `uuidv7()`, the `AppError` hierarchy, the pagination helpers and `PagedResult`.

## Capabilities

### New Capabilities
- `api-conventions`: covers the HTTP behaviour every endpoint shares. That is the `/api/v1` prefix,
  the success and error envelopes, validation failures (422 with field details), pagination
  parameters and `meta`, unknown routes, malformed bodies, and the unversioned `GET /health` probe.

### Modified Capabilities
- None (no specs exist yet).

## Impact

- **Frontend:** this change serves every screen indirectly. The client's envelope unwrap, `ApiError`
  parsing and form error mapping (`src/lib/api/client.ts`, `form-errors.ts`) rely on these shapes.
  It needs no UI change.
- **Code:** `src/main.ts`, `src/app.module.ts`, `src/api/*`, `src/shared/*`,
  `src/infrastructure/persistence/*`, `migrations/`, `seeds/` and `scripts/`.
- **Dependencies:** NestJS 11, `@nestjs/cqrs`, `@nestjs/config`, `@nestjs/swagger`,
  `@nestjs/sequelize`, `sequelize`, `sequelize-typescript`, `pg`, `class-validator` and
  `class-transformer`. Dev dependencies: jest, ts-jest, supertest, eslint, prettier.
- **Ops:** local Postgres through docker-compose on port 5436.
