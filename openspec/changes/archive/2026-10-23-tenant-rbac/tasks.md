# Tasks

## 1. Schema and catalogue

- [x] 1.1 Write `migrations/0004_rbac.sql` (modules, permissions, role_permissions, the active-only role code index) per D1. Verify with `npm run db:migrate`.
- [x] 1.2 Add `seeds/permission-catalogue.seed.ts` (idempotent upsert, frontend labels and order), register it first in `seeds/index.ts`, run it from the test global setup, and add an integration spec (18 codes, idempotent). Verify with `npm run test:int`.

## 2. Domain

- [x] 2.1 Add the `Role` aggregate (create, rename/code derivation, describe, grant, deactivate, system protection), the `ModuleModel`, `PermissionModel` and `RolePermissionModel` models, and a spec. Verify with `npm test`.

## 3. Infrastructure

- [x] 3.1 Extend `AuthQueries.findAccount` with effective permissions (owner gets all; union otherwise; shared SQL fragment) and add integration cases for owner, union, inactive roles and platform users. Verify with `npm run test:int`.
- [x] 3.2 Extend `RoleRepository` and `UserRepository` per D5, add `PermissionCatalogue`, and add integration specs for grants, active-only code uniqueness, holder count and role replacement. Verify with `npm run test:int`.
- [x] 3.3 Add `RbacQueries` and `TenantUserQueries` per D6 and `TenantPersistenceModule`, with integration specs for ordering, system role permissions, userCount, tenant isolation, search/status and isOwner. Verify with `npm run test:int`.

## 4. Application

- [x] 4.1 Extend `Authorization.ts` with `requireTenant`, `requirePermission` and `assertHoldsAll`, with specs. Verify with `npm test`.
- [x] 4.2 Add the rbac module slices (getpermissions, getroles, createrole, updaterole, deleterole) with handler specs for every error code in D8. Verify with `npm test`.
- [x] 4.3 Add the tenantuser module slices (gettenantusers, gettenantuser, createtenantuser, updatetenantuser, changetenantuserstatus, resettenantuserpassword) with handler specs for every error code in D8. Verify with `npm test`.

## 5. API

- [x] 5.1 Add `PermissionsController`, `RolesController` and `UsersController` with Swagger docs, and register them in `ApiModule`. Verify that `npm run build` passes.

## 6. End-to-end

- [x] 6.1 Add `test/tenant-rbac.e2e-spec.ts` covering every scenario of the three specs (including the grant change taking effect on the next request, and deactivation revoking sessions). Verify with `npm run test:e2e`.
- [x] 6.2 Smoke-test through the real frontend (production build): owner login, `/permissions`, create role, create user, new user login and reset, permission-limited user gating, deactivate. Record the results in the PR.

## 7. Pre-flight

- [x] 7.1 Run the §18.4 pre-flight and `openspec validate tenant-rbac --strict`, then fill in the scorecard. Verify that every command exits 0.

## Workflow follow-up

- Archive the change on the branch, then open the PR to `development` and merge it.
