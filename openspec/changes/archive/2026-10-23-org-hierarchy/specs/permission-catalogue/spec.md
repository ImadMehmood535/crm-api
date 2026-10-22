# Spec Delta

## MODIFIED Requirements

### Requirement: Catalogue contents
The catalogue SHALL hold exactly these codes:
- `users.view`, `users.create`, `users.edit`, `users.deactivate`;
- `roles.view`, `roles.create`, `roles.edit`, `roles.delete`;
- `departments.view`, `departments.create`, `departments.edit`, `departments.delete`;
- `teams.view`, `teams.create`, `teams.edit`, `teams.delete`;
- `projects.view`, `projects.create`, `projects.edit`, `projects.delete`;
- `units.view`, `units.create`, `units.edit`, `units.delete`;
- `branding.view`, `branding.edit`.

It lives in database tables filled by an idempotent seed, never in application logic.

#### Scenario: Seed twice
- **WHEN** the seed runs twice
- **THEN** each code exists exactly once
