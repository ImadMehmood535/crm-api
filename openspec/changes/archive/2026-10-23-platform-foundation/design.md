# Design: Platform foundation

## Context

See proposal.md for the motivation. The repo has no code yet. The frontend talks to `{API_URL}/api/v1`
through a Next rewrite. It unwraps `{ success, data, meta }` and builds an `ApiError` from
`error.code`, `error.message` and `error.details[]` (`crm-developer-ui/src/lib/api/client.ts`,
`types.ts`, `form-errors.ts`). The previous implementation (`~/projects/invespy/current/crm-developer-api`,
Fastify and Prisma) is used only as a behavioural reference.

## Goals / Non-Goals

**Goals:**
- One documented, binding set of conventions in `ARCHITECTURE.md`, so later changes only add modules.
- A running service: `npm run start:dev` serves `/health` and `/docs`, migrations apply and the test
  suites run against a real Postgres.

**Non-Goals:**
- Auth, tenancy enforcement and business modules. They follow in later changes; this one only fixes
  their conventions.
- Rate limiting (decided: later).

## Decisions

### D1. HTTP platform: Express, global prefix
Use `@nestjs/platform-express`, `app.setGlobalPrefix('api/v1', { exclude: ['health'] })`, and port
`PORT` (default 3000).
- *Alternative:* Fastify, as in the old API. Rejected: Express is the Nest default, works with
  supertest out of the box and needs no extra adapters. The performance difference does not matter
  at this scale.

### D2. Persistence: Sequelize with snake_case and UUID v7
- Models use `@Table({ tableName: 'users', underscored: true, timestamps: true })`. Attributes are
  camelCase in TypeScript and snake_case in the database (`createdAt` ↔ `created_at`).
  `synchronize` is **off**.
- The abstract `BaseModel` declares `id: UUID` (primary key, default `uuidv7()`), `createdAt` and
  `updatedAt`. Sequelize's own timestamps replace the old `AuditHook`, so there is one less moving
  part. `Model.update()` stamps `updatedAt` too.
- `uuidv7()` lives in `src/shared/utils/Uuid.ts`: a 48-bit millisecond timestamp, version and variant
  bits, and random bits from `crypto.randomBytes`, about 15 lines with tests. Ids sort by creation
  time, which keeps B-tree inserts local.
  - *Alternative:* the `uuid` package. Rejected because the function is small and has no edge cases
    worth a dependency.
  - *Alternative:* Postgres `gen_random_uuid()`, which is v4. Rejected because the user asked for v7.
- Join tables (`user_roles`, `role_permissions`, `team_members`, …) have composite primary keys and
  their own small models that do **not** extend `BaseModel`. They belong to the aggregate that owns
  the relationship: a User's `roleIds` and a Role's `permissions`. They are never aggregates themselves.

### D3. Migrations and seeds: plain SQL plus a tiny runner
- `migrations/0001_<name>.sql`, `0002_…`: forward-only SQL, applied in file-name order.
- `src/infrastructure/persistence/migrator.ts`:
  - creates `schema_migrations(name text primary key, applied_at timestamptz)`;
  - runs each pending file inside its own transaction;
  - records it;
  - stops at the first failure.
  Exposed as `npm run db:migrate`, and also used by the integration/e2e global setup.
- `seeds/`: TypeScript seed functions run by `npm run db:seed`. They must be idempotent
  (`INSERT … ON CONFLICT DO NOTHING`), because seeds rerun on every environment.
- *Alternatives:* `sequelize-cli` or `umzug`. Rejected because both add a dependency and a JS DSL,
  where plain SQL is reviewable, and the runner is about 40 lines. `synchronize: true` was rejected
  by the user (it cannot alter existing tables).

### D4. Errors
- `src/shared/errors/AppError.ts`: an abstract `AppError` with `code`, `status` and optional `details`.
  The subclasses are:
  - `ValidationFailedError` (422 `VALIDATION_FAILED`, details required);
  - `NotFoundError` (404, default code `NOT_FOUND`);
  - `ConflictError` (409, code passed in, for example `SLUG_CONFLICT`);
  - `ForbiddenError` (403, code passed in, for example `FORBIDDEN_OPERATION`);
  - `UnauthenticatedError` (401, code passed in, default `UNAUTHENTICATED`).
  Specific codes are passed as constructor arguments instead of one class per code, which keeps the
  number of classes small.
- `src/api/filters/AllExceptionsFilter.ts`:
  - an `AppError` maps to its own status and code;
  - a Nest `NotFoundException` (unknown route) maps to 404 `NOT_FOUND`;
  - a body-parser `SyntaxError` with status 400 maps to 400 `BAD_REQUEST`;
  - a `PayloadTooLargeException` maps to 413 `PAYLOAD_TOO_LARGE`;
  - anything else is logged and maps to 500 `INTERNAL_ERROR`.
  `@nestjs/common` exceptions are only ever thrown by the framework, never by our code (R6 still holds).

### D5. Validation: class-validator on Request DTOs, invariants in aggregates
- A global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`. Its
  `exceptionFactory` flattens class-validator errors into `details[]` with dot-notation fields and
  throws `ValidationFailedError`. One pass reports **all** bad fields, as the spec requires.
- Aggregates keep business invariants through `Guards`. These throw `ValidationFailedError` with a
  single `{ field, messages }` detail.
- *Alternative:* collecting every error inside aggregates. Rejected because it needs a validation
  framework of our own, while the frontend's "all fields at once" need is about request shape, which
  class-validator already covers.
- Path ids use `ParseUuidPipe` (in-house, in `src/api/pipes/`). It throws `NotFoundError` for a
  non-UUID, so a malformed id and an unknown id look the same.

### D6. Envelope
- `src/api/interceptors/EnvelopeInterceptor.ts`:
  - wraps every result as `{ success: true, data: result ?? null }`;
  - when a handler returns `PagedResult` (`src/shared/utils/Pagination.ts`: `{ items, meta }`), the
    body is `{ success: true, data: items, meta }`.
- `@RawResponse()` (`src/api/common/RawResponse.ts`) opts out. It is used by `/health` and later by
  binary image endpoints.
- `PageQuery` DTO (`src/api/common/PageQuery.ts`): `page` (≥1, default 1) and `pageSize` (1–100,
  default 20). It is validated by class-validator, so `pageSize=101` gives 422.

### D7. Transactions
- `src/infrastructure/persistence/abstraction/IUnitOfWork.ts` exports
  `UNIT_OF_WORK = Symbol('UNIT_OF_WORK')` and an `IUnitOfWork` interface with
  `run<T>(work: (tx: Tx) => Promise<T>): Promise<T>`. `Tx` is an opaque type alias, so application
  code never imports Sequelize (R4).
- `SequelizeUnitOfWork` wraps `sequelize.transaction(...)`. Repository write methods take an optional
  last parameter `tx?: Tx`.
- *Alternative:* CLS-scoped automatic transactions (`cls-hooked`). Rejected because the implicit
  context makes it hard to see which statements share a transaction.

### D8. Tenancy convention (documented now, enforced from the auth change on)
- Every tenant-owned table has `organization_id uuid not null`, with an index and an FK to
  `organizations`.
- Commands and queries carry the caller (`Actor`: `userId`, `organizationId | null`, `plane`).
  Tenant repositories and queries take `organizationId` as an explicit parameter and always filter by
  it. A row of another tenant is reported as 404, never 403.

### D9. Layout additions to ARCHITECTURE.md
`migrations/`, `seeds/`, `src/api/{common,filters,interceptors,pipes}`,
`src/infrastructure/persistence/{DatabaseModule,migrator,SequelizeUnitOfWork}.ts`,
`src/shared/utils/{Uuid,Pagination}.ts`, `src/shared/errors/AppError.ts`. The §2/§3/§16 boundary
rules stay. R7 (audit fields) becomes "never set `id`/`createdAt`/`updatedAt` by hand". R12 becomes
"`synchronize` must stay false".

### D10. Configuration
`.env.example` defines:
- `PORT=3000`
- `DATABASE_URL=postgres://postgres:postgres@localhost:5436/crm_developer`
- `DATABASE_URL_TEST=…/crm_developer_test`

`docker-compose.yml` runs `postgres:16-alpine` on host port 5436 with a healthcheck, and an init
script creates the test database.

### D11. Tests
Jest has three suites:
- unit: `*.spec.ts`;
- integration: `*.int-spec.ts`;
- e2e: `test/*.e2e-spec.ts`.

The integration and e2e suites use `DATABASE_URL_TEST`. Their global setup refuses a database whose
name does not end in `_test`, then runs the migrator. E2E tests boot the real `AppModule` through
supertest.

## Risks / Trade-offs

- [Hand-written migrations drift from the Sequelize models] → Every change adds its migration and
  model in the same task. Integration tests run against the migrated schema, so a mismatched column
  fails a test.
- [`forbidNonWhitelisted` rejects fields an older frontend still sends] → The DTOs are written from
  the frontend's own request types. E2E tests send exactly those bodies.
- [In-house UUID v7 bugs] → Unit tests check the version nibble, the variant bits, monotonic ordering
  across milliseconds, and uniqueness over 10k ids.

## Migration Plan

This is greenfield, with no deployed data. Run `docker compose up -d`, then `npm run db:migrate`.
Rollback means dropping the local database.
