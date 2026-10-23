# tenant-roles Specification

## Purpose
Lets a company manage named roles that grant catalogue permissions to its staff. The company's
built-in owner role is protected, and nobody can grant more than they hold.

## Requirements

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

### Requirement: Create role
`POST /api/v1/roles` with `{ name, description?, permissions[] }` (needs `roles.create`) SHALL answer
201 with the `Role`:
- `name` is 2–60 characters and `description` at most 200;
- `code` is derived from the name (lowercase, non-alphanumerics become `_`);
- an unknown permission code is 422 on `permissions`;
- an active role of the same company with the same code is 409 `ROLE_NAME_CONFLICT`;
- granting a code the caller does not hold is 403 `PERMISSION_ESCALATION`.

#### Scenario: Create
- **WHEN** the owner creates "HR Assistant" with `users.view` and `users.create`
- **THEN** the API answers 201 with code `hr_assistant` and those permissions

#### Scenario: Duplicate name
- **WHEN** an active role named "hr assistant" already exists
- **THEN** the API answers 409 `ROLE_NAME_CONFLICT`

#### Scenario: Escalation
- **WHEN** a user holding only `roles.create` and `users.view` creates a role granting `users.edit`
- **THEN** the API answers 403 `PERMISSION_ESCALATION`

### Requirement: Update role
`PATCH /api/v1/roles/{id}` (needs `roles.edit`) SHALL update the given name, description and
permissions; omitted fields stay unchanged and `null` clears the description. The built-in role is
403 `SYSTEM_ROLE_PROTECTED`. Editing a role that holds a code the caller lacks, or granting such a
code, is 403 `PERMISSION_ESCALATION`. A role of another company is 404.

#### Scenario: Rename and regrant
- **WHEN** the owner renames "Sales" to "Sales Team" and grants `projects.view`
- **THEN** the role has the new name, code `sales_team` and the new permissions, and its holders gain `projects.view` on their next request

#### Scenario: Built-in role
- **WHEN** anyone patches the owner role
- **THEN** the API answers 403 `SYSTEM_ROLE_PROTECTED`

### Requirement: Deactivate role
`DELETE /api/v1/roles/{id}` (needs `roles.delete`) SHALL deactivate the role, answering 200 with
`data: null`. A deactivated role no longer appears in lists and can no longer be assigned. A role
still assigned to any user is 409 `ROLE_IN_USE`, and the built-in role is 403
`SYSTEM_ROLE_PROTECTED`.

#### Scenario: Unused role
- **WHEN** the owner deletes a role nobody holds
- **THEN** the API answers 200, and the role is gone from `GET /api/v1/roles`

#### Scenario: Role in use
- **WHEN** the role is assigned to 2 users
- **THEN** the API answers 409 `ROLE_IN_USE` with a message naming the 2 users
