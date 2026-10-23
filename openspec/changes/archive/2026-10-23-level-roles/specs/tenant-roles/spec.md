## MODIFIED Requirements

### Requirement: Role shape and listing
A `Role` SHALL be `{ id, name, code, description, isSystem, permissions, userCount, createdAt }`.
Built-in roles (the owner role and the "Admin" and "Department Head" level roles) have `isSystem:
true` and list their derived codes. `GET /api/v1/roles` (needs `roles.view`) lists the company's
active roles, built-in first and then by name, with `search` on the name and `meta`.

#### Scenario: List
- **WHEN** a company has the built-in roles and a custom role "Sales"
- **THEN** the built-in roles come first with `isSystem: true`, followed by "Sales" with its own codes and `userCount`

#### Scenario: Other companies hidden
- **WHEN** another company has a role "Sales"
- **THEN** it is not in the caller's list

#### Scenario: Level roles are locked
- **WHEN** a caller edits, deactivates or assigns the "Admin" role by hand
- **THEN** the API answers 403 `SYSTEM_ROLE_PROTECTED`
