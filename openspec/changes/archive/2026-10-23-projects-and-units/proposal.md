# Proposal: Projects and units

## Why

The tenant workspace's inventory screens need real data:
- the Projects list (`/app/projects`);
- the project detail with its units table (`/app/projects/[id]`);
- the home page's inventory card;
- the platform dashboard's project and unit totals.

They currently have no backend.

## What Changes

- **Projects:**
  - list (`projects.view`): search over name or city, status filter, pagination, newest first, each
    with `unitCounts`;
  - create (`projects.create`);
  - detail and partial update (`projects.edit`; `null` clears optional fields);
  - delete (`projects.delete`), which is refused with 409 `PROJECT_HAS_UNITS` while units exist.
  - The name is unique per company, case- and space-insensitively (409 `PROJECT_NAME_CONFLICT`).
- **Units:**
  - list inside a project (`units.view`): search over number or notes, status and type filters,
    natural order by number (A-2 before A-10);
  - create (`units.create`);
  - detail and partial update (`units.edit`); a unit never moves to another project;
  - delete (`units.delete`).
  - The number is unique per project (409 `UNIT_NUMBER_CONFLICT`).
- **Validation** follows the contract:
  - project name 2–120 characters;
  - unit number 1–40 characters;
  - bedrooms and bathrooms 0–50;
  - floor -5 to 200;
  - area > 0 with 2 decimals;
  - price 0 to 99,999,999,999.99 with 2 decimals;
  - ISO-4217 currency, default `USD`;
  - `expectedCompletion` as `YYYY-MM-DD`.
- `GET /platform/stats` now reports real project and unit totals.
- Every change is audited.

## Capabilities

### New Capabilities
- `projects`: a company's development projects and their inventory counts.
- `units`: the sellable units inside a project.

### Modified Capabilities
- `platform-insights`: `counts.projects.total` and `counts.units.total` reflect real data.

## Impact

- **Frontend:** `/app/projects`, `/app/projects/[id]` (units table, inline status change), the home
  inventory card and the platform dashboard tiles. No UI change.
- **Code:**
  - `migrations/0006_projects_and_units.sql`;
  - the `Project` and `Unit` aggregates;
  - the `project` and `unit` modules;
  - `ProjectsController` and `UnitsController`;
  - the stats query.
