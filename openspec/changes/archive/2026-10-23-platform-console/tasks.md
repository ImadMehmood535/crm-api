# Tasks

## 1. Schema and shared helpers

- [x] 1.1 Write `migrations/0003_platform_console.sql` (invites, audit_logs with the append-only trigger, mail_outbox) per D1. Verify with `npm run db:migrate` and an integration check that `UPDATE audit_logs` raises.
- [x] 1.2 Add `shared/utils/SecureToken.ts`, `shared/utils/TemporaryPassword.ts`, the `AppError` code override for `SLUG_RESERVED`, and `application/common/Authorization.ts` (`requirePlatform`, `requirePlatformSuperUser`), with unit specs. Verify with `npm test`.

## 2. Domain

- [x] 2.1 Add the `Organization` aggregate (create guards, reserved slugs, idempotent suspend/reactivate) and its spec. Verify with `npm test`.
- [x] 2.2 Extend the `User` aggregate (`createTenantOwner`, `createPlatformAdmin`, `deactivate`, name guards) and add its spec. Verify with `npm test`.
- [x] 2.3 Add the `Invite` aggregate and `InviteModel` (issue, derived expiry, renew, revoke, accept, `INVITE_NOT_PENDING`) with a spec, plus `AuditLogModel` and `MailOutboxModel`. Verify with `npm test`.

## 3. Infrastructure

- [x] 3.1 Add `OrganizationRepository`, `RoleRepository`, `InviteRepository` and the `UserRepository` additions, with integration specs for slug/email checks, the live pending invite rule, and the owner role. Verify with `npm run test:int`.
- [x] 3.2 Add `AuditLog` (allow-list and redaction) and `ConsoleMailer` (outbox and log), with integration specs covering redaction and the outbox row. Verify with `npm run test:int`.
- [x] 3.3 Add `DeveloperQueries`, `InviteQueries`, `PlatformAdminQueries`, `PlatformStatsQueries` and `AuditQueries`, plus `PlatformPersistenceModule`, with integration specs for userCount/owner/search/order, derived expired filtering, admin role mapping, weekly buckets/counts/activity mapping, and audit filters. Verify with `npm run test:int`.

## 4. Application slices

- [x] 4.1 Add the developer module: getdevelopers, getdeveloper, onboarddeveloper (transactional; owner role; temp password; audit; slug and email rules), changedeveloperstatus serving suspend and reactivate (idempotent and audited), with handler specs for every error code and for tenant callers getting 403. Verify with `npm test`.
- [x] 4.2 Add the invite module: getinvites, issueinvite (rules, mail, audit), resendinvite, revokeinvite, previewinvite and acceptinvite (transactional, session via `SessionIssuer`), with handler specs. Verify with `npm test`.
- [x] 4.3 Add the platformadmin module: getplatformadmins, createplatformadmin (super user only), deactivateplatformadmin (`LAST_SUPER_USER`, session revocation), with handler specs. Verify with `npm test`.
- [x] 4.4 Add the platforminsights module: getplatformstats (weeks 1–26) and getauditlog, with handler specs. Verify with `npm test`.

## 5. API

- [x] 5.1 Add `PlatformDevelopersController`, `PlatformInvitesController`, `PublicInvitesController`, `PlatformAdminsController` and `PlatformInsightsController`, register the modules in `ApiModule`, add `APP_BASE_URL` to `.env.example`, and document the Swagger annotations. Verify that `npm run build` passes and `/docs` lists every route.

## 6. End-to-end

- [x] 6.1 Add `test/platform-console.e2e-spec.ts` covering every scenario of the four specs, including the accept flow logging in and `LAST_SUPER_USER`. Verify with `npm run test:e2e`.
- [x] 6.2 Smoke-test against the real frontend (production build) through the console flows: onboard, suspend, invite, accept, create admin and deactivate it. Record the results in the PR.

## 7. Pre-flight

- [x] 7.1 Run the §18.4 pre-flight and `openspec validate platform-console --strict`, then fill in the scorecard. Verify that every command exits 0.

## Workflow follow-up

- Archive the change on the branch, then open the PR to `development` and merge it.
