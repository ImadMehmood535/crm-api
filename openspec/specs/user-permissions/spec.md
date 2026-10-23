# user-permissions Specification

## Purpose
Lets an authorised person fine-tune one user's permissions on top of what their roles give, without creating a new role.

## Requirements

### Requirement: Permission breakdown
`GET /api/v1/users/{id}/permissions` (needs `users.view`) SHALL answer `{ rolePermissions, granted, revoked, permissions }`:
- `rolePermissions`: the codes the user's roles give;
- `granted`: codes added for this user only;
- `revoked`: role codes removed for this user only;
- `permissions`: the effective set, which is (rolePermissions ∪ granted) − revoked.

All lists are sorted. A user the caller may not see is 404.

#### Scenario: Role only
- **WHEN** a member holds only the role "Sales" granting `projects.view` and `units.view`
- **THEN** `rolePermissions` and `permissions` are both those two codes, and `granted` and `revoked` are empty

### Requirement: Set a user's permissions
`PUT /api/v1/users/{id}/permissions` with `{ permissions: string[] }` (needs `users.edit`) SHALL make that list the user's effective set by storing grants (codes beyond the roles) and revokes (role codes left out), and SHALL answer with the breakdown. Sending exactly the role codes clears all overrides. The change applies on the user's next request.

#### Scenario: Grant and revoke
- **WHEN** the owner sets a Sales member's permissions to `projects.view` and `projects.edit`
- **THEN** `granted` is `projects.edit`, `revoked` is `units.view`, and the member's next `GET /auth/me` lists `projects.edit` and `projects.view`

### Requirement: Override safeguards
Setting permissions SHALL follow the user-management safeguards:
- the owner cannot be changed (403 `FORBIDDEN_OPERATION`);
- a stronger target is 403 `PERMISSION_ESCALATION`;
- your own permissions are 403 `FORBIDDEN_OPERATION`;
- a desired code the caller lacks is 403 `PERMISSION_ESCALATION`;
- an unknown code is 422 on `permissions`.

Overrides survive role and level changes.

#### Scenario: Own permissions
- **WHEN** a user sets their own permissions
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

#### Scenario: Unknown code
- **WHEN** the list contains `ships.sail`
- **THEN** the API answers 422 with a detail for `permissions`
