# Tasks

## 1. Schema and config

- [x] 1.1 Write `migrations/0002_identity_and_sessions.sql` per design D1 and verify that `npm run db:migrate` applies it and `\d users` shows the constraints.
- [x] 1.2 Add `jsonwebtoken` + `@types/jsonwebtoken`, the R1 allowlist entry, and the env variables in `.env.example` (`JWT_ACCESS_SECRET`, TTLs, `PLATFORM_SUPER_USER_*`). Verify that `npm run check:boundaries` is green.

## 2. Domain

- [x] 2.1 Add the models: `OrganizationModel`, `UserModel`, `UserCredentialModel`, `UserRoleModel`, `RoleModel`, `SessionModel`. Verify they compile.
- [x] 2.2 Add the `Session` aggregate (`isActive(now)`, `isRotated`) and the `User` aggregate (status and name accessors used by auth), with specs. Verify with `npm test`.

## 3. Security services

- [x] 3.1 Add `ScryptPasswordHasher` (`hash`, `verify`, `dummyVerify`) with a spec covering round-trip, wrong password, a malformed stored hash, and different salts for the same password. Verify with `npm test`.
- [x] 3.2 Add `JwtAccessTokens` (`sign`, `verify` with HS256, issuer and audience pinned) with a spec covering round-trip, expired, tampered, `alg: none` and wrong audience. Verify with `npm test`.

## 4. Persistence

- [x] 4.1 Add `UserRepository` (`findByEmail`, `findById`, `findCredential`, `setPassword`, `markLoggedIn`) and `SessionRepository` (`create`, `findByTokenHash`, `findById`, `rotate` in a transaction with `FOR UPDATE`, `revokeFamily`, `revokeAllForUser`), with integration specs covering rotation, the concurrent rotate that loses, and family revocation. Verify with `npm run test:int`.
- [x] 4.2 Add `AuthQueries` (`findAccount(userId)`) and `AuthPersistenceModule`, with an integration spec for the platform and tenant shapes and active role codes only. Verify with `npm run test:int`.

## 5. Application slices

- [x] 5.1 Add `AccessPolicy`, `shared/auth/Actor.ts`, `ISessionRepository.isFamilyActive` and the `SessionIssuer` helper, with specs for policy order (company before user). Verify with `npm test`.
- [x] 5.2 Add `features/login/` (LoginCommand, handler, LoginRequest, AuthSessionResponse), with handler specs: success, unknown email, wrong password, suspended only after a correct password, inactive. Verify with `npm test`.
- [x] 5.3 Add `features/refresh/` (RefreshCommand, handler, RefreshRequest), with specs: rotate, unknown, expired, reuse revokes the family, suspended → 403. Verify with `npm test`.
- [x] 5.4 Add `features/logout/` and `features/getme/`, with specs. Verify with `npm test`.
- [x] 5.5 Add `features/resetpassword/` (command, handler, request), with specs: success revokes all and issues new, wrong current → 401, too short / same → 422 `newPassword`. Verify with `npm test`.
- [x] 5.6 Add `features/resolveactor/` (ResolveActorQuery + handler), with specs: valid, bad JWT, revoked session, session of another user, suspended, inactive. Then add `AuthModule`. Verify with `npm test`.

## 6. API

- [x] 6.1 Add `api/common/{Public,AllowWhenResetRequired,CurrentActor}.ts`, `api/guards/AuthGuard.ts` (APP_GUARD) and `api/controllers/AuthController.ts` (login/refresh public with `@HttpCode(200)`; logout/me/reset allowed while reset is required), and mark `HealthController` as public. Verify that `npm run build` passes and `/health` stays public.

## 7. Seed

- [x] 7.1 Add `seeds/platform-identity.seed.ts` (platform roles plus the super user from env, idempotent) and register it in `seeds/index.ts`, with an integration spec covering a run twice and the existing password left unchanged. Verify with `npm run test:int` and `npm run db:seed`.

## 8. End-to-end

- [x] 8.1 Add `test/support/fixtures.ts` (create an organization and users with passwords in the test database, plus a truncate helper) and `test/auth-sessions.e2e-spec.ts` covering every scenario in `specs/auth-sessions/spec.md`. Verify with `npm run test:e2e`.
- [x] 8.2 Smoke-test against the real frontend: run the API on port 3000 with a seeded super user, then `pnpm dev` in crm-developer-ui (`.env.local` with mocking disabled). Log in as the platform user, check that session restore survives a reload, and log out. Verify by observation, recorded in the PR.

## 9. Pre-flight

- [x] 9.1 Run the §18.4 pre-flight and `openspec validate auth-sessions --strict`, then fill in the scorecard. Verify that every command exits 0.

## Workflow follow-up

- Archive the change on the branch, then open the PR to `development` and merge it.
