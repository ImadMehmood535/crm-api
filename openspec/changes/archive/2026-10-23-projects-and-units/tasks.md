# Tasks

## 1. Schema and domain

- [x] 1.1 Write `migrations/0006_projects_and_units.sql` per D1 (with CHECKs and the composite FK). Verify with `npm run db:migrate`.
- [x] 1.2 Add the `Project` and `Unit` aggregates, the `nameKey` and `naturalSortKey` helpers and the models, with unit specs (defaults, every limit with max and max+1, currency uppercase, natural order). Verify with `npm test`.

## 2. Infrastructure

- [x] 2.1 Add `ProjectRepository`, `UnitRepository`, `InventoryQueries` and `InventoryPersistenceModule`, and update `PlatformStatsQueries` totals, with integration specs (name uniqueness ignoring case and spaces, counts, natural order, filters, numeric conversion, tenant isolation, composite FK). Verify with `npm run test:int`.

## 3. Application and API

- [x] 3.1 Add the project slices and the unit slices with handler specs for every error code and permission. Verify with `npm test`.
- [x] 3.2 Add `ProjectsController` and `UnitsController` with Swagger docs, and register them. Verify that `npm run build` passes.

## 4. End-to-end

- [x] 4.1 Add `test/projects-and-units.e2e-spec.ts` covering every scenario of the specs, including the stats totals. Verify with `npm run test:e2e`.
- [x] 4.2 Smoke-test through the real frontend: create a project, add units, change a unit status inline, check the counts, refuse deleting a project that has units. Record the results in the PR.

## 5. Pre-flight

- [x] 5.1 Run the §18.4 pre-flight and `openspec validate projects-and-units --strict`, then fill in the scorecard. Verify that every command exits 0.

## Workflow follow-up

- Archive the change on the branch, then open the PR to `development` and merge it.
