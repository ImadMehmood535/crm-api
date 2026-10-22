# units Specification

## Purpose
Lets a company manage the sellable units of each project: their type, sales status, size, price and
notes.

## Requirements

### Requirement: Unit shape
A `Unit` SHALL be
`{ id, projectId, number, type, status, bedrooms, bathrooms, areaSqm, floor, price, notes, createdAt, updatedAt }`:
- `type` is one of `apartment`, `villa`, `townhouse`, `plot`, `shop` or `office`;
- `status` is one of `available`, `reserved`, `sold` or `blocked`;
- the numeric fields are JSON numbers or null.

#### Scenario: Price as a number
- **WHEN** a unit priced 250000.50 is returned
- **THEN** `price` is the number `250000.5`

### Requirement: List units of a project
`GET /api/v1/projects/{id}/units` (needs `units.view`) SHALL list the project's units in natural
order of their number (A-2 before A-10), with `search` (number or notes), `status`, `type`,
pagination and `meta`. An unknown or other-company project is 404.

#### Scenario: Natural order
- **WHEN** a project has units A-10, A-2 and A-1
- **THEN** they are listed A-1, A-2, A-10

### Requirement: Create unit
`POST /api/v1/projects/{id}/units` (needs `units.create`) SHALL answer 201 with the `Unit`. `number`
is required, `type` defaults to `apartment` and `status` to `available`. A number already used in the
project (case-insensitive) is 409 `UNIT_NUMBER_CONFLICT`.

#### Scenario: Create
- **WHEN** the owner adds unit A-101, a villa with 4 bedrooms at 250000
- **THEN** the API answers 201 and the project's `unitCounts.available` grows by one

### Requirement: Unit field limits
Unit fields SHALL be validated together as 422 `VALIDATION_FAILED`:
- `number` is 1–40 characters;
- `bedrooms` and `bathrooms` are whole numbers 0–50; `floor` is a whole number -5 to 200;
- `areaSqm` is above 0 with at most 2 decimals; `price` is 0–99,999,999,999.99 with at most 2
  decimals;
- `notes` is at most 2000 characters.

#### Scenario: Invalid numbers
- **WHEN** bedrooms is 2.5 and floor is 300
- **THEN** the API answers 422 with details for `bedrooms` and `floor`

### Requirement: Read, update and delete unit
`GET /api/v1/units/{id}` (needs `units.view`), `PATCH` (needs `units.edit`; partial; `null` clears
optional fields) and `DELETE` (needs `units.delete`; 200 `data: null`) SHALL act only on the
caller's company's units. A unit never moves to another project. Renumbering to a number already used
in its project is 409 `UNIT_NUMBER_CONFLICT`.

#### Scenario: Inline status change
- **WHEN** a user holding `units.edit` patches `{ "status": "sold" }`
- **THEN** the unit is sold and the project's counts reflect it
