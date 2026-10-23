## Why

The product owner clarified on 2026-10-23 how roles and levels fit together:
- The director (company owner) creates admins, and an admin automatically holds everything the director can do. The director still stays untouchable.
- Department heads automatically hold a team-management permission set.
- Only members are given custom roles.
- An admin sees the whole company.

Today every user, admins included, must be given custom roles by hand, and admins only see the people created under admins.

## What Changes

- **Built-in level roles:** every company gets two locked roles next to the owner role.
  - "Admin" (`level_admin`) holds every catalogue code, including codes added later.
  - "Department Head" (`level_department_head`) holds a fixed team-management set.
  - Neither can be edited, deactivated or assigned by hand (403 `SYSTEM_ROLE_PROTECTED`).
- **Create user:** `roleIds` is only needed for `member`. For `admin` and `department_head`, the level's built-in role is assigned and any `roleIds` are ignored.
- **Update user:**
  - Changing the level swaps the built-in role.
  - Moving a user down to `member` needs `roleIds` (422 on `roleIds` otherwise).
  - Sending `roleIds` for an admin or a head is 422 on `roleIds`.
- **Visibility:** an admin sees every user of the company, like the owner. Heads and members are unchanged.
- **Roles list:** the level roles appear as built-in roles (`isSystem: true`) with their derived codes.
- **Data:** migration `0008_level_roles.sql` adds `roles.level_role`. The idempotent seed `level-roles` creates the roles for existing companies and moves existing admins and heads onto them.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `org-hierarchy`: admins see the whole company.
- `tenant-users`: roles depend on the level on create and update.
- `permission-catalogue`: effective permissions include the level roles.
- `tenant-roles`: built-in level roles are listed and locked.

## Impact

- **Backend:** RoleRepository, EffectivePermissionsSql, VisibilitySql, RbacQueries, the tenant-user create/update handlers, onboarding and invite acceptance, and the seeds.
- **Frontend** (local only):
  - The user form hides the role picker for admin and head, and shows it again when moving a user to member.
  - The roles list shows the right access summary.
  - The MSW mocks follow the new rules.
