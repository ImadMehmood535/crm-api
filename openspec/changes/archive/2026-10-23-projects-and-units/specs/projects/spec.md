# Spec Delta

## Purpose

Lets a company manage its development projects, each with a live count of its units by status.

## ADDED Requirements

### Requirement: Project shape
A `Project` SHALL be
`{ id, name, description, city, address, currency, status, expectedCompletion, unitCounts, createdAt, updatedAt }`:
- `status` is one of `planning`, `active`, `completed` or `archived`;
- `expectedCompletion` is `YYYY-MM-DD` or null;
- `unitCounts` is `{ total, available, reserved, sold, blocked }`.

#### Scenario: Counts
- **WHEN** a project has 3 available units and 1 sold unit
- **THEN** its `unitCounts` is `{ total: 4, available: 3, reserved: 0, sold: 1, blocked: 0 }`

### Requirement: List projects
`GET /api/v1/projects` (needs `projects.view`) SHALL list the caller's company's projects newest
first, with `search` (name or city, case-insensitive), `status`, pagination and `meta`. Other
companies' projects never appear.

#### Scenario: Search by city
- **WHEN** the caller searches `lahore`
- **THEN** only projects whose name or city contains it are listed

### Requirement: Create project
`POST /api/v1/projects` (needs `projects.create`) SHALL answer 201 with the `Project`.
- `name` is required, 2–120 characters;
- `description` at most 2000, `city` at most 100, `address` at most 300;
- `currency` is a 3-letter code, stored in uppercase, default `USD`;
- `status` defaults to `planning`;
- `expectedCompletion` is a valid `YYYY-MM-DD` or null.
Bad fields are 422 together. A name already used in the company, ignoring case and repeated spaces,
is 409 `PROJECT_NAME_CONFLICT`.

#### Scenario: Create
- **WHEN** the owner creates "Palm Heights" in Lahore with currency `pkr`
- **THEN** the API answers 201 with `currency: "PKR"`, `status: "planning"` and zero counts

#### Scenario: Duplicate name
- **WHEN** another project is called "palm  heights"
- **THEN** the API answers 409 `PROJECT_NAME_CONFLICT`

### Requirement: Read and update project
`GET /api/v1/projects/{id}` (needs `projects.view`) SHALL return the project. `PATCH` (needs
`projects.edit`) applies only the given fields; `null` clears an optional field, while `currency` and
`status` cannot be cleared. Another company's or an unknown id is 404 `NOT_FOUND`.

#### Scenario: Clear the city
- **WHEN** the owner patches `{ "city": null, "status": "active" }`
- **THEN** the project has `city: null` and `status: "active"`

### Requirement: Delete project
`DELETE /api/v1/projects/{id}` (needs `projects.delete`) SHALL delete a project without units and
answer 200 with `data: null`. A project with units is 409 `PROJECT_HAS_UNITS`.

#### Scenario: Project with units
- **WHEN** the project still has a unit
- **THEN** the API answers 409 `PROJECT_HAS_UNITS`
