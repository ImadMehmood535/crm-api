# tenant-users Specification

## Purpose
Lets a company manage its staff accounts and their roles. The company owner and the caller's own
account are protected, and nobody can manage someone holding more access than themselves.

## Requirements

### Requirement: Tenant user shape and listing
A `TenantUser` SHALL be `{ id, email, firstName, lastName, status, level, isOwner, roles: [{ id, name, code }], teams: [{ id, name }], permissions, lastLoginAt, createdAt }`.
`GET /api/v1/users` (needs `users.view`) lists the users of the caller's company that the caller may
see, oldest first, with `search` (name or email), `status` (`active`/`inactive`) and `meta`.
`GET /api/v1/users/{id}` returns one such user. Another company's user, or one the caller may not
see, is 404.

#### Scenario: List
- **WHEN** the owner lists users
- **THEN** each user shows level, roles, teams, effective permissions and `isOwner`, which is true only for the owner

#### Scenario: Other company
- **WHEN** the caller requests a user id from another company
- **THEN** the API answers 404 `NOT_FOUND`

### Requirement: Create user
`POST /api/v1/users` with `{ email, firstName, lastName, roleIds?, level?, teamIds? }` (needs
`users.create`) SHALL answer 201 with `{ user, temporaryPassword }`. The new user must reset the
password at first login. Roles depend on the level:
- `admin` and `department_head` get their level's built-in role; `roleIds` is ignored;
- a `member` needs at least one role (422 on `roleIds`);
- other role errors: 422 `roleIds`, 403 `SYSTEM_ROLE_PROTECTED`, 403 `PERMISSION_ESCALATION`;
- a registered email is 409 `EMAIL_CONFLICT`.

#### Scenario: Create
- **WHEN** the owner adds `hira@skyline.example.com` with the role "HR Assistant"
- **THEN** the API answers 201, and Hira's login has `mustResetPassword: true` and that role's permissions

#### Scenario: No roles
- **WHEN** a member is created with `roleIds` empty
- **THEN** the API answers 422 with a detail for `roleIds`

#### Scenario: Admin gets the Admin role
- **WHEN** the owner creates a user with `level: "admin"` and no `roleIds`
- **THEN** the user holds only the built-in "Admin" role and every catalogue code

### Requirement: New user level and teams
On create, `level` SHALL default to `member` and must be a level the caller may create (403
`FORBIDDEN_OPERATION` otherwise). Every id in `teamIds` must be an active team the caller may manage
(422 on `teamIds` otherwise). The memberships are written in the same transaction as the user.

#### Scenario: Head adds a member to a team
- **WHEN** the head of "Finance" creates a member with `teamIds` [Payables]
- **THEN** the member is listed in Payables and is visible to the head

### Requirement: Update user
`PATCH /api/v1/users/{id}` with `{ firstName?, lastName?, roleIds?, level? }` (needs `users.edit`)
SHALL update the given fields and answer with the `TenantUser`. A level change swaps the built-in
role; moving to `member` needs `roleIds` (422 otherwise). `roleIds` for an admin or head is 422.
Changing your own roles is 403 `FORBIDDEN_OPERATION`.

#### Scenario: Change roles
- **WHEN** the owner changes Hira's roles to "Viewer"
- **THEN** Hira's next request carries only Viewer's permissions

#### Scenario: Own roles
- **WHEN** a user changes their own `roleIds`
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

#### Scenario: Promote to head
- **WHEN** the owner changes member M to `level: "department_head"`
- **THEN** M holds only the built-in "Department Head" role

### Requirement: Management safeguards
Editing, activating, deactivating or resetting the password of the company owner SHALL be 403
`FORBIDDEN_OPERATION`. Managing a user who holds a permission the caller lacks is 403
`PERMISSION_ESCALATION`.

#### Scenario: Owner untouchable
- **WHEN** a user with every user permission except ownership tries to deactivate the owner
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

#### Scenario: Stronger target
- **WHEN** a user holding `users.view` and `users.edit` edits a user who also holds `roles.edit`
- **THEN** the API answers 403 `PERMISSION_ESCALATION`

### Requirement: Activate and deactivate
`POST /api/v1/users/{id}/deactivate` and `/activate` (needs `users.deactivate`) SHALL set the
status and answer with the `TenantUser`. Deactivation revokes the user's sessions, so their next
request answers 401 `UNAUTHENTICATED`, and a new login answers 403 `ACCOUNT_INACTIVE`. Deactivating
yourself is 403 `FORBIDDEN_OPERATION`.

#### Scenario: Deactivate
- **WHEN** the owner deactivates Hira
- **THEN** Hira's status is `inactive` and her refresh token stops working

#### Scenario: Self
- **WHEN** a user deactivates their own account
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

### Requirement: Reset a user's password
`POST /api/v1/users/{id}/reset-password` (needs `users.edit`) SHALL set a new one-time temporary
password, require a reset at next login, revoke the user's sessions, and answer
`{ user, temporaryPassword }`. Resetting your own password here is 403 `FORBIDDEN_OPERATION`.

#### Scenario: Reset
- **WHEN** the owner resets Hira's password
- **THEN** the response holds the temporary password, and Hira's old password no longer works
