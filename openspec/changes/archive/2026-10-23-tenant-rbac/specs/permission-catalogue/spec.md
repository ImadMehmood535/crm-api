# Spec Delta

## Purpose

Defines the catalogue of tenant modules and actions that roles grant, and how a tenant user's
effective `module.action` permissions are resolved on every request.

## ADDED Requirements

### Requirement: Catalogue endpoint
`GET /api/v1/permissions` SHALL return the catalogue as `[{ module, label, actions: [{ action, label, code }] }]`,
in a stable order, where `code` is `module.action`. It requires the permission `roles.view` and the
tenant plane.

#### Scenario: Read catalogue
- **WHEN** a tenant user holding `roles.view` calls `GET /api/v1/permissions`
- **THEN** the response lists the modules `users`, `roles`, `projects`, `units` and `branding` with their actions, for example `{ action: "view", label: "View users", code: "users.view" }`

#### Scenario: Without permission
- **WHEN** a tenant user without `roles.view` calls it
- **THEN** the API answers 403 `PERMISSION_DENIED`

### Requirement: Catalogue contents
The catalogue SHALL hold exactly these codes:
- `users.view`, `users.create`, `users.edit`, `users.deactivate`;
- `roles.view`, `roles.create`, `roles.edit`, `roles.delete`;
- `projects.view`, `projects.create`, `projects.edit`, `projects.delete`;
- `units.view`, `units.create`, `units.edit`, `units.delete`;
- `branding.view`, `branding.edit`.

It lives in database tables filled by an idempotent seed, never in application logic.

#### Scenario: Seed twice
- **WHEN** the seed runs twice
- **THEN** each code exists exactly once

### Requirement: Effective permissions
A tenant user's effective permissions SHALL be:
- every catalogue code, when they hold the company's built-in owner role (`developer_super_user`),
  including codes added later;
- otherwise, the union of the codes granted to their active roles.

Platform users have none. Permissions are resolved on every request, so changes apply immediately.

#### Scenario: Owner holds everything
- **WHEN** a company owner signs in
- **THEN** `user.permissions` contains all 18 catalogue codes

#### Scenario: Union of roles
- **WHEN** a user holds role A granting `users.view` and role B granting `projects.view`
- **THEN** `user.permissions` is `["projects.view", "users.view"]`

#### Scenario: Grant revoked
- **WHEN** a role loses `users.view` while its holder is signed in
- **THEN** the holder's next `GET /api/v1/users` answers 403 `PERMISSION_DENIED`

### Requirement: Tenant endpoints check plane and permission
Every tenant endpoint SHALL answer 403 `PERMISSION_DENIED` to platform users and to tenant users
missing the endpoint's permission, before touching any data.

#### Scenario: Platform user on a tenant endpoint
- **WHEN** a platform user calls `GET /api/v1/roles`
- **THEN** the API answers 403 `PERMISSION_DENIED`
