# Design: Tenant RBAC

## Context

See proposal.md. The `roles` and `user_roles` tables, the per-company owner role
(`developer_super_user`, `is_system_role = true`) created by onboarding and invite acceptance, the
`Actor` with `permissions`, the audit log and the unit of work all exist. Exact behaviour comes from
`crm-developer-ui/src/mocks/rbac-handlers.ts` and `rbac-model.ts`, and the input spec is `rbac.md`.

## Goals / Non-Goals

**Goals:** the Users and Roles screens, the permission matrix and permission gating work against the
API, with the safeguards of the spec.

**Non-Goals:**
- The org hierarchy (admins, department heads, teams) and hierarchy-based user visibility. These come
  in the next change, `org-hierarchy`. Until then a user with `users.view` sees the whole company.
- User types and record-level scope (deferred by decision).
- A permission cache (decision 22: no cache).

## Decisions

### D1. Schema (`migrations/0004_rbac.sql`)
| Table | Columns | Constraints |
| ----- | ------- | ----------- |
| `modules` | `id uuid`, `code varchar(100)`, `name varchar(100)`, `parent_module_id uuid?` → modules, `description text?`, `sort_order int`, `is_active bool default true`, `created_at`, `updated_at` | `UNIQUE(code)` |
| `permissions` | `id uuid`, `module_id uuid` → modules, `action varchar(50)`, `code varchar(150)`, `name varchar(100)` (the label), `description text?`, `sort_order int`, `created_at`, `updated_at` | `UNIQUE(code)`, `UNIQUE(module_id, action)` |
| `role_permissions` | `role_id` → roles, `permission_id` → permissions, `granted_by uuid?` → users, `granted_at timestamptz default now()` | PK `(role_id, permission_id)`; idx `permission_id` |

The roles index changes:
```sql
DROP INDEX uq_roles_org_code;
CREATE UNIQUE INDEX uq_roles_org_code_active ON roles (organization_id, code)
  WHERE organization_id IS NOT NULL AND is_active;
```
This lets a deactivated role's name be reused, following decision 13 (deactivate).

### D2. Effective permissions (one place: `AuthQueries.findAccount`)
For tenant users, one SQL statement:
- if the user holds an active `developer_super_user` role → every `permissions.code`;
- else → the `DISTINCT` codes from `role_permissions` of their active roles.

Results are sorted. Platform users get `[]`. The owner's role has no grant rows, so new catalogue
modules reach owners automatically (decision 18). `TenantUserQueries` uses the same SQL fragment
(`EFFECTIVE_PERMISSIONS_SQL`, exported from one file) to show other users' permissions.

### D3. `Role` aggregate (`domain/aggregates/RoleAggregate/Role.ts`)
- `create({ organizationId, name, description, permissions })`;
- `rename(name)`, which also re-derives `code` (`roleCodeFrom(name)`: lowercase, non-alphanumeric
  runs become `_`, trimmed of `_`, and it must contain a letter or digit);
- `describe(description)` (at most 200 characters, blank becomes null);
- `grant(codes)`, which dedupes and sorts;
- `deactivate()`;
- `assertEditable()`, which throws `ForbiddenError('SYSTEM_ROLE_PROTECTED')` for the system role.

Name: 2–60 characters. The same limits sit on the request DTOs for 422 field details.

### D4. Tenant access helpers (`application/common/Authorization.ts`, extended)
- `requireTenant(actor) → organizationId`;
- `requirePermission(actor, code)`: 403 `PERMISSION_DENIED`;
- `assertHoldsAll(actor, codes, message)`: 403 `PERMISSION_ESCALATION`. Used:
  - when granting codes to a role;
  - when editing a role that holds codes the caller lacks;
  - when assigning roles;
  - when managing a user whose effective permissions exceed the caller's.

### D5. Write side
| Repository | Methods |
| ---------- | ------- |
| `IRoleRepository` (extended) | `saveTenantRole(role, grantedBy, tx)` (row plus `role_permissions`), `updateTenantRole(role, grantedBy, tx)` (replaces the grant set), `findTenantRole(organizationId, id)`, `findActiveTenantRoles(organizationId, ids)`, `activeCodeExists(organizationId, code, exceptId?)`, `countHolders(roleId)` |
| `IUserRepository` (extended) | `findTenantUser(organizationId, id)`, `replaceRoles(userId, roleIds, assignedBy, tx)` |
| `IPermissionCatalogue` (read) | `allCodes()`, used to validate requested codes (422 `permissions`) |

### D6. Read side
| Queries | Methods |
| ------- | ------- |
| `IRbacQueries` | `catalogue()` → modules with actions ordered by `sort_order`; `findRoles({ organizationId, search, page })` (active only, system role first, then `lower(name)`; `permissions` = every code for the system role, else its grants; `userCount`); `findRole(organizationId, id)` |
| `ITenantUserQueries` | `findList({ organizationId, search, status, page })` (oldest first; roles as `{ id, name, code }` of active roles; effective `permissions`; `isOwner` = holds the active system role); `findById(organizationId, id)` |

### D7. Slices
- `application/modules/rbac/features`: `getpermissions`, `getroles`, `createrole`, `updaterole`,
  `deleterole` (the deactivate behaviour).
- `application/modules/tenantuser/features`: `gettenantusers`, `gettenantuser`, `createtenantuser`,
  `updatetenantuser`, `changetenantuserstatus` (activate and deactivate share one slice),
  `resettenantuserpassword`.
- Controllers: `PermissionsController` (`permissions`), `RolesController` (`roles`),
  `UsersController` (`users`).

### D8. Safeguard order (matches the mock, so the UI shows the expected message)
- **Roles:** permission check → load (404) → system role (403 `SYSTEM_ROLE_PROTECTED`) → field
  validation (422) → escalation (403) → name conflict (409) → in use (409, delete only).
- **Users** (the mock's order):
  1. permission check;
  2. load (404);
  3. own deactivation or own password reset (403 `FORBIDDEN_OPERATION`);
  4. owner (403 `FORBIDDEN_OPERATION`);
  5. target stronger than the caller (403 `PERMISSION_ESCALATION`);
  6. own role change (403 `FORBIDDEN_OPERATION`);
  7. role validation (422 `roleIds`, 403 `SYSTEM_ROLE_PROTECTED`, 403 escalation);
  8. email conflict (409, create only).

### D9. Sessions and passwords
Deactivating a user or resetting their password revokes all their sessions (`revokeAllForUser`).
The temporary password comes from `newTemporaryPassword()`, and `must_reset_password = true`.
Activating does not touch sessions.

### D10. Audit actions
`role.created`, `role.updated` (old and new name and permissions), `role.deactivated`,
`user.created`, `user.updated` (names and role ids), `user.activated`, `user.deactivated`,
`user.password_reset`. Each carries `organization_id`. The temporary password is never logged; the
redactor would drop it in any case.

### D11. Seed (`seeds/permission-catalogue.seed.ts`)
It upserts the modules and permissions by `code` (`ON CONFLICT (code) DO UPDATE SET name, sort_order`)
in the frontend's order and labels:

| Module | Label | Actions |
| ------ | ----- | ------- |
| users | Users | View users · Add users · Edit users and their roles · Deactivate / reactivate users |
| roles | Roles | View roles · Create roles · Edit roles · Delete roles |
| projects | Projects | view, create, edit, delete |
| units | Units | view, create, edit, delete |
| branding | Company branding | View branding · Edit branding |

It runs before `platform-identity`. Integration and e2e global setup also run this seed, because the
catalogue is reference data that tests need.

## Risks / Trade-offs

- [Permission SQL on every request] → One indexed query (user_roles → roles → role_permissions →
  permissions). This was accepted with decision 22. Revisit if profiling shows it hot.
- ["Delete role" now deactivates] → The user-visible outcome is the same. The frontend label change
  ("Deactivate") is listed for the frontend change.

## Migration Plan

Run `npm run db:migrate`, then `npm run db:seed` (the catalogue).
