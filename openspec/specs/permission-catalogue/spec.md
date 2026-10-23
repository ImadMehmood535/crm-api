# permission-catalogue Specification

## Purpose
Defines the catalogue of tenant modules and actions that roles grant, and how a tenant user's
effective `module.action` permissions are resolved on every request.

## Requirements

### Requirement: Catalogue endpoint
`GET /api/v1/permissions` SHALL return the catalogue as `[{ module, label, actions: [{ action, label, code }] }]`,
in a stable order, where `code` is `module.action`. It requires the permission `roles.view` and the
tenant plane.

#### Scenario: Read catalogue
- **WHEN** a tenant user holding `roles.view` calls `GET /api/v1/permissions`
- **THEN** the response lists the modules `users`, `roles`, `departments`, `teams`, `projects`, `units` and `branding` with their actions, for example `{ action: "view", label: "View users", code: "users.view" }`

#### Scenario: Without permission
- **WHEN** a tenant user without `roles.view` calls it
- **THEN** the API answers 403 `PERMISSION_DENIED`

### Requirement: Catalogue contents
The catalogue SHALL hold exactly 26 codes:
- `view`, `create`, `edit` and `delete` for `roles`, `departments`, `teams`, `projects` and `units`;
- `view`, `create`, `edit` and `deactivate` for `users`;
- `view` and `edit` for `branding`.

It lives in database tables filled by an idempotent seed, never in application logic.

#### Scenario: Seed twice
- **WHEN** the seed runs twice
- **THEN** each code exists exactly once

### Requirement: Effective permissions
A tenant user's effective permissions SHALL be their role codes plus their granted overrides,
minus their revoked overrides. Role codes are:
- every catalogue code for holders of the owner role or the "Admin" level role;
- the department head set for holders of the "Department Head" level role;
- plus the union of the codes granted to their other active roles.

Platform users have none. Permissions are resolved on every request.

#### Scenario: Owner holds everything
- **WHEN** a company owner signs in
- **THEN** `user.permissions` contains all 26 catalogue codes

#### Scenario: Union of roles
- **WHEN** a user holds role A granting `users.view` and role B granting `projects.view`
- **THEN** `user.permissions` is `["projects.view", "users.view"]`

#### Scenario: Grant revoked
- **WHEN** a role loses `users.view` while its holder is signed in
- **THEN** the holder's next `GET /api/v1/users` answers 403 `PERMISSION_DENIED`

#### Scenario: Department head set
- **WHEN** a department head signs in
- **THEN** `user.permissions` is exactly `departments.view`, `projects.view`, `roles.view`, `teams.*`, `units.view` and `users.*`

#### Scenario: User override
- **WHEN** a member's role gives `units.view` but it is revoked for them
- **THEN** `user.permissions` does not contain `units.view`

### Requirement: Tenant endpoints check plane and permission
Every tenant endpoint SHALL answer 403 `PERMISSION_DENIED` to platform users and to tenant users
missing the endpoint's permission, before touching any data.

#### Scenario: Platform user on a tenant endpoint
- **WHEN** a platform user calls `GET /api/v1/roles`
- **THEN** the API answers 403 `PERMISSION_DENIED`
