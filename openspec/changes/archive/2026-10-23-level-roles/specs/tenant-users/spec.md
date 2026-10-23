## MODIFIED Requirements

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
