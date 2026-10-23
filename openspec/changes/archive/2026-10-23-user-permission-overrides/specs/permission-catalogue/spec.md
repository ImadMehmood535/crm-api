## MODIFIED Requirements

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
