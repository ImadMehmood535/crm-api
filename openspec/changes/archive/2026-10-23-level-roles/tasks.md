## 1. Schema and seed

- [x] 1.1 Write `migrations/0008_level_roles.sql` (D1) and the idempotent `level-roles` seed (D3). Verify with `npm run db:migrate` and `npm run db:seed` (run twice).

## 2. Infrastructure

- [x] 2.1 Add `DEPARTMENT_HEAD_PERMISSIONS`, then derive level-role codes in `EffectivePermissionsSql` and `RbacQueries`. Add `isSystem` for level roles and `RoleRepository.levelRoleId`. Verify with integration specs.
- [x] 2.2 Make admins see the whole company (`scoped`, CTE). Verify by updating the visibility integration spec.

## 3. Application

- [x] 3.1 Use `levelRoleId` for both levels in onboarding and accept-invite.
- [x] 3.2 Apply the D5 create/update rules, with handler specs.

## 4. End-to-end

- [x] 4.1 Add e2e coverage: admin auto role and all codes, the head set, a member without roles (422), promote/demote, roleIds for an admin (422), admin sees the owner's branch, and the locked level role (403).

## 5. Pre-flight

- [x] 5.1 Run the §18.4 pre-flight and `openspec validate level-roles --strict`.

## Follow-up
- Frontend (local only):
  - hide the role picker for admin/head and require it when moving to member;
  - fix the roles access column;
  - update the mocks and tests;
  - re-check in the browser.
