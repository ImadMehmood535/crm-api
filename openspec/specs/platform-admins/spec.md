# platform-admins Specification

## Purpose
Lets the platform super user manage the Invespy operators (platform admins) who use the console, and
makes sure there is always at least one active platform super user.

## Requirements

### Requirement: List platform admins
`GET /api/v1/platform/admins` SHALL return every platform user, active and inactive, as
`PlatformAdmin[]` with `meta`. A `PlatformAdmin` is `{ id, email, firstName, lastName, role, isActive, createdAt }`,
where `role` is `platform_super_user` or `platform_admin`. Any platform user may read the list.

#### Scenario: Inactive admins listed
- **WHEN** one admin has been deactivated
- **THEN** that admin is still listed with `isActive: false`

### Requirement: Create platform admin
`POST /api/v1/platform/admins` with `{ email, firstName, lastName }` SHALL answer 201 with
`{ admin, temporaryPassword }`. The new user has the role `platform_admin` and must reset the password
at first login. Only a platform super user may call it; a `platform_admin` gets 403
`PERMISSION_DENIED`. Invalid fields are 422 and an existing email is 409 `EMAIL_CONFLICT`.

#### Scenario: Super user creates
- **WHEN** the platform super user creates an admin
- **THEN** the API answers 201, and the temporary password logs in with `mustResetPassword: true`

#### Scenario: Admin may not create
- **WHEN** a `platform_admin` tries to create an admin
- **THEN** the API answers 403 `PERMISSION_DENIED`

### Requirement: Deactivate platform admin
`POST /api/v1/platform/admins/{id}/deactivate` SHALL set the admin inactive, revoke their sessions and
answer 200 with the `PlatformAdmin`. Only a platform super user may call it. Deactivating the last
active platform super user is 409 `LAST_SUPER_USER`. An unknown id, or a tenant user's id, is 404.

#### Scenario: Deactivate
- **WHEN** the super user deactivates an admin
- **THEN** the API answers 200 with `isActive: false`, and the admin's next request answers 403 `ACCOUNT_INACTIVE`

#### Scenario: Last super user
- **WHEN** the only active platform super user is the target
- **THEN** the API answers 409 `LAST_SUPER_USER`
