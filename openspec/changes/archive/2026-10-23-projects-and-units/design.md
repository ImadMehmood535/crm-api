# Design: Projects and units

## Context

See proposal.md. Expected behaviour comes from `crm-developer-ui/src/mocks/inventory-handlers.ts` and
the contract section "Projects & Units". Tenancy, permissions (`projects.*`, `units.*` are already in
the catalogue), audit and the unit of work exist.

## Goals / Non-Goals

**Goals:** the inventory screens and the dashboard totals work against the API.

**Non-Goals:** record-level scope (deferred), bulk import, unit detail pages, sorting controls.

## Decisions

### D1. Schema (`migrations/0006_projects_and_units.sql`)
- **`projects`:**
  - columns: `id`, `organization_id` → organizations, `name varchar(120)`, `name_key varchar(120)`
    (lowercase, trimmed, single-spaced), `description text?` (≤ 2000 CHECK), `city varchar(100)?`,
    `address varchar(300)?`, `currency char(3) default 'USD'` (CHECK `^[A-Z]{3}$`),
    `status varchar(20) default 'planning'` (CHECK), `expected_completion date?`,
    `created_by uuid?` → users, `created_at`, `updated_at`;
  - constraints: `UNIQUE(organization_id, name_key)`, `UNIQUE(organization_id, id)` (the target of
    the units composite FK);
  - indexes: idx `(organization_id, status)` and `(organization_id, created_at DESC)`.
- **`units`:**
  - columns: `id`, `organization_id`, `project_id`, `number varchar(40)`, `number_key varchar(40)`,
    `number_sort varchar(200)` (number_key with digit runs zero-padded to 10), `type varchar(20)`
    (CHECK), `status varchar(20) default 'available'` (CHECK), `bedrooms smallint?` (0–50),
    `bathrooms smallint?` (0–50), `area_sqm numeric(10,2)?` (> 0), `floor smallint?` (-5–200),
    `price numeric(14,2)?` (≥ 0), `notes text?` (≤ 2000), `created_by uuid?`, `created_at`,
    `updated_at`;
  - the **composite FK** `(organization_id, project_id) → projects(organization_id, id)` keeps a unit
    inside its project's company;
  - `UNIQUE(project_id, number_key)`; idx `(project_id, number_sort)`, `(project_id, status)` and
    `(organization_id, status)`.
- Every limit is also a DB CHECK, so bad data cannot enter even through bugs.

### D2. Aggregates
- **`Project`:** `create`, `rename`, `describe`, `relocate(city, address)`, `setCurrency` (uppercase,
  3 letters), `changeStatus`, `scheduleCompletion(date | null)`.
- **`Unit`:** `create`, `renumber` (also computes `numberKey`/`numberSort`), `changeType`,
  `changeStatus`, `setLayout(bedrooms, bathrooms, floor)`, `setArea`, `setPrice`, `annotate`.
- **Pure helpers:** `nameKey()` and `naturalSortKey()`, both unit-tested.

Request DTOs carry the same limits through class-validator (`IsInt`, `Min`, `Max`,
`IsNumber({ maxDecimalPlaces: 2 })`, `Length`, `Matches`), so every bad field is reported together.
`null` passes `IsOptional` and means "clear".

### D3. Write and read sides
- **`IProjectRepository`:** `save`, `update`, `findById(org, id)`, `nameKeyExists(org, key, exceptId?)`,
  `hasUnits(id)`, `delete(id, tx)`.
- **`IUnitRepository`:** `save`, `update`, `findById(org, id)`,
  `numberKeyExists(projectId, key, exceptId?)`, `delete(id, tx)`.
- **`IInventoryQueries`:**
  - `findProjects({ org, search, status, page })`, with `unitCounts` via `count(*) FILTER (WHERE status = …)`
    in a lateral join;
  - `findProject(org, id)`;
  - `findUnits({ org, projectId, search, status, type, page })`, ordered by
    `number_sort, number_key, id`;
  - `findUnit(org, id)`.
  - Numeric columns come back as strings from `pg`, and are converted with `Number()`.
- `PlatformStatsQueries` counts `projects` and `units`.

### D4. Slices and routes
`application/modules/project/features`: `getprojects`, `getproject`, `createproject`,
`updateproject`, `deleteproject`. `application/modules/unit/features`: `getunits` (per project),
`getunit`, `createunit`, `updateunit`, `deleteunit`.
- `ProjectsController` → `projects`, plus `projects/:id/units` (GET and POST).
- `UnitsController` → `units/:id`.
Audit actions: `project.created|updated|deleted` and `unit.created|updated|deleted`.

## Risks / Trade-offs

- [Counts computed per list page] → One grouped subquery per page of at most 100 projects, on the
  indexed `(project_id, status)`.
