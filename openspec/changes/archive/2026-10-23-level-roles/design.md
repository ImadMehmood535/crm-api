# Design: Built-in level roles

## Context
Product owner, 2026-10-23: the role picker is hidden for admins and heads, and their roles are set automatically. An admin can do everything the director can, except manage the director. An admin sees the whole company. Decisions are recorded in memory (Q&A):
- the team-management set for heads;
- whole-company visibility for admins;
- locked built-in roles.

## Decisions

### D1. Schema (`migrations/0008_level_roles.sql`)
- `roles.level_role varchar(20) NULL`, with `CHECK (level_role IN ('admin','department_head'))`.
- A partial unique index on `(organization_id, level_role) WHERE level_role IS NOT NULL AND is_active`.
- `is_system_role` keeps meaning "owner role". Ownership (effective level `owner`, `isOwner`) stays defined by that flag alone, so level roles never make someone an owner.

### D2. Permissions are derived, not granted
Level roles have no `role_permissions` rows. `EffectivePermissionsSql` and the role read model derive their codes:
- `level_admin` → every catalogue code (like the owner, so codes added later are included);
- `level_department_head` → the constant set `DEPARTMENT_HEAD_PERMISSIONS` (`shared/auth/LevelPermissions.ts`):
  - `users.view`, `users.create`, `users.edit`, `users.deactivate`;
  - `teams.view`, `teams.create`, `teams.edit`, `teams.delete`;
  - `departments.view`, `roles.view`, `projects.view`, `units.view`.

The set is a code constant, embedded as SQL literals (never input), so it stays one source of truth.

### D3. Creating level roles
- `IRoleRepository.levelRoleId(org, level, tx)` gets or creates the active level role:
  - codes `level_admin` / `level_department_head`;
  - names "Admin" / "Department Head";
  - `is_system_role = false`, `level_role` set.
- Onboarding and invite acceptance call it for both levels, so a new company's roles list shows them.
- The seed `level-roles` (idempotent, uuidv7):
  - creates them for every existing company;
  - replaces the roles of existing `admin`/`department_head` users with their level role.

### D4. Locking
The Role aggregate's `isSystem` becomes `is_system_role OR level_role IS NOT NULL`. `assertEditable` already refuses system roles (403 `SYSTEM_ROLE_PROTECTED`), so edit, deactivate and manual assignment are blocked with no new code paths. The read model's `isSystem` follows the same rule.

### D5. User create/update
- **Create:**
  - `admin`/`department_head`: `replaceRoles(id, [levelRoleId])`, and `roleIds` is ignored;
  - `member`: the existing rules, with `roleIds` now optional in the DTO but required by the handler (422 `roleIds`).
- **Update:** the resulting level is `changes.level ?? target.level`.
  - A level change to admin/head sets the level role.
  - A change to member requires `roleIds`.
  - `roleIds` sent for an admin/head result is 422 `roleIds`.

### D6. Visibility
`scoped(viewer)` is false for `owner` and `admin`; the CTE drops `admin_tree`. Department and team scoping was already company-wide for admins.

## Risks / Trade-offs
- [An admin can now manage other admins' accounts (edit, reset, deactivate), since they hold equal permissions] → This matches "admin has everything except the director". Level changes of admins still need the owner (D2 of org-hierarchy).
