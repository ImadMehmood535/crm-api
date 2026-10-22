# Tasks

## 1. Schema and catalogue

- [x] 1.1 Write `migrations/0007_org_hierarchy.sql` (users.level with backfill, departments, teams, team_members, idx `users.created_by`) per D1. Verify with `npm run db:migrate`.
- [x] 1.2 Add the `departments` and `teams` modules to the catalogue seed (the order and labels follow the matrix) and update the seed and catalogue tests (now 26 codes). Verify with `npm run test:int`.

## 2. Domain

- [x] 2.1 Add `UserLevel` rules, plus the `Department` and `Team` aggregates and models, with unit specs (creation matrix, name limits, head assignment, deactivation). Verify with `npm test`.

## 3. Infrastructure

- [x] 3.1 Add the effective level to `AuthQueries` (`AuthUser.level`) and the `Actor`, with integration and unit specs. Verify with `npm run test:int` and `npm test`.
- [x] 3.2 Add `VisibilitySql` and apply it to `TenantUserQueries` (level, teams, viewer filter), with an integration spec covering every visibility scenario in the spec. Verify with `npm run test:int`.
- [x] 3.3 Add `DepartmentRepository`, `TeamRepository`, `OrgStructureQueries` and `OrgStructurePersistenceModule`, with integration specs (name uniqueness among active rows, counts, membership, scoped lists). Verify with `npm run test:int`.

## 4. Application

- [x] 4.1 Update the tenantuser slices: viewer-aware reads, the level and `teamIds` on create, the level on update, with handler specs. Verify with `npm test`.
- [x] 4.2 Add the orgstructure slices with `OrgScope` and handler specs for every error code. Verify with `npm test`.

## 5. API

- [x] 5.1 Add `DepartmentsController` and `TeamsController`, extend the user DTOs, and register them. Verify that `npm run build` passes.

## 6. End-to-end

- [x] 6.1 Add `test/org-hierarchy.e2e-spec.ts` covering every scenario of both new specs and the modified tenant-users scenarios (the full hierarchy: owner → admin → head → team → member, plus the owner's direct head). Verify with `npm run test:e2e`.

## 7. Pre-flight

- [x] 7.1 Run the §18.4 pre-flight and `openspec validate org-hierarchy --strict`, then fill in the scorecard. Verify that every command exits 0.

## Workflow follow-up

- Archive the change on the branch, then open the PR to `development` and merge it.
- Frontend screens follow in a separate local-only change to `crm-developer-ui`.
