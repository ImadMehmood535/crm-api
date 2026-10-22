# Proposal: Tenant RBAC

## Why

The tenant workspace's Users and Roles screens, and every permission-gated control in the app, need
a real access-control backend. `rbac.md` is the input spec. The decisions taken on 2026-10-23 adapt
it to the existing frontend:
- permissions are `module.action` codes stored in seeded tables;
- users can hold several roles;
- the company owner holds every permission by default;
- the escalation and self-action safeguards stay;
- roles are deactivated, not deleted;
- multi-tenant scoping applies throughout.

Until now `AuthUser.permissions` was always empty, so no tenant screen beyond the shell could work.

## What Changes

- **Permission catalogue** in seeded tables `modules` and `permissions`: users
  (view/create/edit/deactivate), roles (view/create/edit/delete), projects, units and branding.
  `GET /api/v1/permissions` (needs `roles.view`) returns it as the matrix rows and columns.
- **Effective permissions:** the owner (`developer_super_user`, a system role) holds the whole
  catalogue, automatically including modules added later. Everyone else holds the union of their
  active roles' grants. Permissions are resolved on every request (no cache) and exposed in
  `AuthUser.permissions` and the request's `Actor`.
- **Roles:**
  - list (`roles.view`; built-in first; search);
  - create (`roles.create`);
  - partial update (`roles.edit`);
  - `DELETE /roles/{id}` (`roles.delete`), which **deactivates** the role. That is a soft removal by
    decision 13: the role disappears from lists and can no longer be assigned. A role still assigned
    to users is 409 `ROLE_IN_USE`.
  - Safeguards: 403 `SYSTEM_ROLE_PROTECTED`, 403 `PERMISSION_ESCALATION`, 409 `ROLE_NAME_CONFLICT`,
    and 422 for unknown permission codes.
- **Tenant users:**
  - list (`users.view`; search; status);
  - detail;
  - create with roles and a one-time temporary password (`users.create`);
  - partial update of names and roles (`users.edit`);
  - activate and deactivate (`users.deactivate`; deactivation revokes sessions);
  - reset password (`users.edit`; temporary password, must reset).
  - The owner and the caller themselves are protected (403 `FORBIDDEN_OPERATION`), and nobody can
    manage someone with more access than their own (403 `PERMISSION_ESCALATION`).
- **Audit and transactions:** every role and user change is audited, and multi-table writes are
  transactional.
- **Generic tenant helpers** `requireTenant` and `requirePermission` (403 `PERMISSION_DENIED`).

## Capabilities

### New Capabilities
- `permission-catalogue`: the seeded module/action catalogue, its read endpoint, and how a user's
  effective permissions are resolved.
- `tenant-roles`: company roles, their permission grants and the role safeguards.
- `tenant-users`: company staff accounts, role assignment, activation and password resets, with the
  owner, self and escalation safeguards.

### Modified Capabilities
- None. `auth-sessions` already defines `AuthUser.permissions` as the effective codes; this change
  supplies them.

## Impact

- **Frontend:**
  - `/app/roles` (list, permission matrix, create, edit, deactivate);
  - `/app/users` (list, add with assignable roles, edit, deactivate/reactivate, reset password);
  - `PermissionGate` / `usePermissions` and nav gating everywhere;
  - `RequirePermissionPage`.
  The only frontend wording to revisit is "Delete role", which now deactivates. The behaviour seen by
  the user is the same (the role disappears). The label is updated in the frontend change.
- **Code:**
  - `migrations/0004_rbac.sql` (`modules`, `permissions`, `role_permissions`; the roles unique index
    becomes active-only);
  - the `Role` aggregate, and `User` aggregate role changes;
  - `rbac` and `tenantuser` modules;
  - `RolesController`, `UsersController`, `PermissionsController`;
  - `seeds/permission-catalogue.seed.ts`.
