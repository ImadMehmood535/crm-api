# Spec Delta

## MODIFIED Requirements

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
`POST /api/v1/users` with `{ email, firstName, lastName, roleIds[], level?, teamIds? }` (needs
`users.create`) SHALL answer 201 with `{ user, temporaryPassword }`. The new user must reset the
password at first login. `level` defaults to `member` and must be a level the caller may create.
`teamIds` must be teams the caller may manage.
- at least one role is required;
- unknown, inactive or other-company role ids are 422 on `roleIds`;
- the built-in role is 403 `SYSTEM_ROLE_PROTECTED`;
- a role holding codes the caller lacks is 403 `PERMISSION_ESCALATION`;
- a registered email is 409 `EMAIL_CONFLICT`.

#### Scenario: Create
- **WHEN** the owner adds `hira@skyline.example.com` with the role "HR Assistant"
- **THEN** the API answers 201, and Hira's login has `mustResetPassword: true` and that role's permissions

#### Scenario: No roles
- **WHEN** `roleIds` is empty
- **THEN** the API answers 422 with a detail for `roleIds`

#### Scenario: Head adds a member to a team
- **WHEN** the head of "Finance" creates a member with `teamIds` [Payables]
- **THEN** the member is listed in Payables and is visible to the head
