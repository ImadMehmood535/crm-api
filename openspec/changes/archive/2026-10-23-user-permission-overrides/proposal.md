## Why

The product owner asked on 2026-10-23 for a user page that shows a user's permissions (what their roles give) and lets an authorised person adjust that one user's permissions without creating a new role. For example: "Hira has the Sales role, but she may also edit projects", or "this admin may not delete units".

## What Changes

- **Per-user permission overrides on top of roles:**
  - `grant` adds a code the user's roles do not give.
  - `revoke` removes a code the roles give.
  - Effective permissions = (role codes ∪ grants) − revokes.
- **`GET /api/v1/users/{id}/permissions`** (`users.view`) returns `{ rolePermissions, granted, revoked, permissions }`.
- **`PUT /api/v1/users/{id}/permissions`** (`users.edit`) takes `{ permissions }`, the desired effective set; the server stores the difference from the role codes.
  - The usual management safeguards apply: the owner is untouchable, nobody manages a stronger user, and changing your own permissions is 403.
  - Every desired code must be held by the caller (403 `PERMISSION_ESCALATION`).
  - Unknown codes are 422.
  - Sending exactly the role codes clears all overrides.
- Overrides survive role and level changes.

## Capabilities

### New Capabilities
- `user-permissions`: the per-user permission breakdown and overrides.

### Modified Capabilities
- `permission-catalogue`: effective permissions include overrides.

## Impact

- Migration `0009_user_permission_overrides.sql`.
- `EffectivePermissionsSql`, the tenant-user queries and repository, two new slices, and `UsersController`.
- Frontend (local only): a user detail page with the permission matrix.
