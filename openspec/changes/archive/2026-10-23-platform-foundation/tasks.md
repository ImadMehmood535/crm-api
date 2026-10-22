# Tasks

## 1. Architecture guide

- [x] 1.1 Rewrite `ARCHITECTURE.md` sections 1–14 and 15–19 to design D1–D11: UUID v7, snake_case, SQL migrations and seeds, transactions, envelope and error codes, class-validator DTOs, `/api/v1` on port 3000, `page`/`pageSize`, tenancy, join tables, libraries allowed. Update the hard rules and the boundary script. Verify that `grep -nE "BIGINT|globalUId|DomainExceptionFilter|synchronize: true|size'" ARCHITECTURE.md` finds no stale convention.

## 2. Project scaffold

- [x] 2.1 Add `package.json` (scripts per §17.6 plus `db:migrate`/`db:seed`), `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.prettierrc`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `docker-compose.yml` (+ `docker/init-test-db.sql`), and install dependencies. Verify that `npm install` and `npx tsc --noEmit` succeed.
- [x] 2.2 Add `scripts/check-boundaries.sh` from §16.1 and verify `npm run check:boundaries` is green.

## 3. Shared kernel

- [x] 3.1 `src/shared/utils/Uuid.ts` (`uuidv7`, `isUuid`) with `Uuid.spec.ts` covering version and variant bits, ordering and uniqueness. Verify with `npm test`.
- [x] 3.2 `src/shared/errors/AppError.ts` (the AppError hierarchy) with a spec checking status, code and details. Verify with `npm test`.
- [x] 3.3 `src/shared/utils/Pagination.ts` (`PagedResult`, `PageMeta`, `offsetOf`) and `src/shared/domain/Guards.ts` (throwing `ValidationFailedError` with a field), with specs. Verify with `npm test`.

## 4. Persistence

- [x] 4.1 `src/infrastructure/persistence/DatabaseModule.ts` (Sequelize from `DATABASE_URL`, `synchronize: false`, `logging: false`), `BaseModel.ts` (`src/domain/aggregates/BaseModel.ts`), and `abstraction/IUnitOfWork.ts` + `SequelizeUnitOfWork.ts`. Verify it compiles.
- [x] 4.2 `src/infrastructure/persistence/migrator.ts` + `src/infrastructure/persistence/migrate.cli.ts` + `migrations/0001_init.sql` (enables nothing; establishes `schema_migrations`) and `seeds/seed.cli.ts` (no-op runner). Add `migrator.int-spec.ts` (applies once, is idempotent on rerun, rolls back a failing file). Verify with `npm run db:migrate` and `npm run test:int`.

## 5. HTTP conventions

- [x] 5.1 `src/api/filters/AllExceptionsFilter.ts`, `src/api/interceptors/EnvelopeInterceptor.ts`, `src/api/common/RawResponse.ts`, `src/api/common/PageQuery.ts`, `src/api/pipes/ParseUuidPipe.ts`, `src/api/pipes/createValidationPipe.ts`, and `src/api/middleware/RequestLoggerMiddleware.ts`, with unit specs for the filter mappings, the envelope (plain, null, paged), the validation flattening (nested dot paths) and the UUID pipe. Verify with `npm test`.
- [x] 5.2 `src/main.ts` + `src/app.setup.ts` (prefix, pipes, filter, interceptor, Swagger at `/docs`), `src/app.module.ts`, `src/api/ApiModule.ts`, and `src/api/controllers/HealthController.ts` (raw `{status, db}`, 503 when the database is down). Verify that `npm run start:dev` serves `/health` and `/docs`.

## 6. Contract tests

- [x] 6.1 `test/api-conventions.e2e-spec.ts` covering every scenario in `specs/api-conventions/spec.md`: health up, unknown route 404 envelope, malformed JSON 400, validation 422 with all fields and nested dot paths and unknown property, pagination defaults and the max, malformed UUID 404, and 500 with a generic message. It uses a test-only controller registered in the e2e module. Verify with `npm run test:e2e`.

## 7. Pre-flight

- [x] 7.1 Run the §18.4 pre-flight (build, lint, format:check, check:boundaries, test, test:int, test:e2e, test:cov) and `openspec validate platform-foundation`, then fill the §19.5 scorecard in the PR. Verify that every command exits 0.

## Workflow follow-up

- Archive the change (`openspec archive platform-foundation`) on the branch before merging.
- Open the PR to `development` on ImadMehmood535/crm-api and merge it after the checks pass.
