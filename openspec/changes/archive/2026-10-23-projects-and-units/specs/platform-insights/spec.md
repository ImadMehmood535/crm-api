# Spec Delta

## MODIFIED Requirements

### Requirement: Dashboard counts
`GET /api/v1/platform/stats?weeks=N` (N between 1 and 26, default 8) SHALL answer
`{ counts, recentActivity, trends }`. `counts` is
`{ organizations: { total, active, suspended }, users: { total }, projects: { total }, units: { total } }`,
where `users.total` counts tenant users only, and `projects.total` and `units.total` count every
company's projects and units.

#### Scenario: Counts
- **WHEN** there are two active companies, one suspended company, and five tenant users
- **THEN** `counts.organizations` is `{ total: 3, active: 2, suspended: 1 }` and `counts.users.total` is 5

#### Scenario: Out-of-range weeks
- **WHEN** `weeks=27`
- **THEN** the API answers 422 on `weeks`

#### Scenario: Inventory totals
- **WHEN** two companies have 3 projects and 10 units between them
- **THEN** `counts.projects.total` is 3 and `counts.units.total` is 10
