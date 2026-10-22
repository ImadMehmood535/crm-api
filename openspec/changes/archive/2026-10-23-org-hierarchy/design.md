# Design: Organisation hierarchy

## Context

See proposal.md. The input is the product owner's hierarchy (2026-10-23) and the decisions recorded
in memory:
- a user can be in many teams;
- the level is separate from roles and permissions;
- team members see their own team(s).

The tenant RBAC (`tenant-users`, `tenant-roles`) and the `Actor` exist. Users already record
`created_by`.

## Goals / Non-Goals

**Goals:**
- user levels, level-based creation rights, and hierarchy visibility for users;
- departments with heads, teams with many-to-many members;
- the API the new frontend screens need.

**Non-Goals:**
- record-level scope for business records such as projects and leads (deferred by decision 15);
- moving people between companies.

## Decisions

### D1. Schema (`migrations/0007_org_hierarchy.sql`)
- **`users.level varchar(20) NULL`** with `CHECK (level IN ('owner','admin','department_head','member'))`.
  - Backfill: tenant users become `member`, and holders of the company system role become `owner`.
  - Platform users keep NULL.
  - The **effective level** used everywhere is `owner` when the user holds the company's active
    system role, else `coalesce(level, 'member')`. Ownership therefore stays defined in one place
    (the system role), and rows created without a level behave as members.
- **`departments`:**
  - columns: `id`, `organization_id` → organizations, `name varchar(100)`, `name_key varchar(100)`,
    `head_user_id uuid?` → users, `created_by uuid?` → users, `is_active bool default true`,
    `created_at`, `updated_at`;
  - constraints: `UNIQUE(organization_id, id)`; partial unique `(organization_id, name_key) WHERE is_active`;
    idx `head_user_id`.
- **`teams`:**
  - columns: `id`, `organization_id`, `department_id`, `name varchar(100)`, `name_key`,
    `created_by uuid?`, `is_active`, `created_at`, `updated_at`;
  - the composite FK `(organization_id, department_id) → departments(organization_id, id)` keeps a
    team in its department's company;
  - partial unique `(department_id, name_key) WHERE is_active`.
- **`team_members`:** `team_id` → teams, `user_id` → users, `added_by uuid?`, `added_at`.
  PK `(team_id, user_id)`; idx `user_id`.
- The catalogue seed adds the modules `departments` and `teams` (view, create, edit, delete). Owners
  get them automatically.

### D2. Level rules (`domain/aggregates/UserAggregate/UserLevel.ts`, pure)
`CREATABLE = { owner: [admin, department_head, member], admin: [department_head, member], department_head: [member], member: [] }`.
`assertCanCreateLevel(actorLevel, level)` throws 403 `FORBIDDEN_OPERATION`. A level change requires
the actor to be able to create both the current and the new level.

### D3. Visibility (`infrastructure/queries/VisibilitySql.ts`)
One SQL fragment, `VISIBLE_USERS_CTE`, with `:organizationId`, `:viewerId` and `:viewerLevel`, built
from `WITH RECURSIVE`:
- `admin_tree`: the effective admins plus all their `created_by` descendants;
- `own_tree`: the viewer plus their descendants;
- `head_members`: members of the active teams in active departments headed by the viewer;
- `teammates`: members of the viewer's active teams.

`visible` is then:
- owner: all users;
- admin: owners ∪ `admin_tree`;
- department head: `own_tree` ∪ `head_members`;
- member: the viewer ∪ `teammates`.

`TenantUserQueries.findList/findById` take a `viewer { userId, level }` and add
`AND u.id IN (SELECT id FROM visible)`. Owners skip the filter. The read model adds `level` and
`teams` (active teams of the user).

### D4. Actor and AuthUser
`AuthQueries.findAccount` returns the effective level, so `AuthUser.level` (null for the platform)
and `Actor.level` are available to every handler. Adding an extra field to `AuthUser` is safe for
the frontend.

### D5. Departments and teams
- **Aggregates:**
  - `Department` (`create`, `rename` 2–100 characters, `assignHead(userId | null)`, `deactivate`);
  - `Team` (`create`, `rename`, `deactivate`).
- **Repositories:**
  - `IDepartmentRepository`: `save`, `update`, `findById(org, id)`, `activeNameExists`,
    `hasActiveTeams`;
  - `ITeamRepository`: `save`, `update`, `findById(org, id)`, `activeNameExists(departmentId, key, except)`,
    `hasMembers`, `addMember`, `removeMember`.
- **`IOrgStructureQueries`:** `findDepartments(viewer)`, `findDepartment`, `findTeams(viewer, departmentId?)`,
  `findTeam`. Head and member candidates are checked with `ITenantUserQueries.findById(org, id, viewer)`,
  which already returns visibility, effective level, status and `isOwner`.
- **Scope rules** (`application/modules/orgstructure/OrgScope.ts`):
  - departments are managed by owners and admins only;
  - teams by owners and admins (any) or by the department's head;
  - anyone else gets 403 `FORBIDDEN_OPERATION`;
  - permission codes are checked first (403 `PERMISSION_DENIED`).
- **Membership:** the user must be visible to the actor (D3), active, in the company, and not the
  owner; otherwise 422 `userId`.

### D6. User creation and update
- `CreateTenantUserRequest` gains `level?` (default `member`) and `teamIds?` (UUIDs; every team must
  be manageable by the actor, else 422 `teamIds`). Memberships are written in the same transaction.
- `UpdateTenantUserRequest` gains `level?` (D2 rules).
- The management safeguards from `tenant-rbac` stay, plus visibility: a target the caller cannot see
  is 404.

### D7. Slices and routes
`application/modules/orgstructure/features`:
- `getdepartments`, `createdepartment`, `updatedepartment`, `deletedepartment` (deactivate);
- `getteams`, `createteam`, `updateteam`, `deleteteam` (deactivate);
- `addteammember`, `removeteammember`.

Controllers:
- `DepartmentsController` → `departments`;
- `TeamsController` → `teams`, `teams/:id/members`, `teams/:id/members/:userId`.

Audit actions: `department.created|updated|deactivated`, `team.created|updated|deactivated`,
`team.member_added|member_removed`.

## Risks / Trade-offs

- [The recursive visibility query runs on every users list] → It walks `users.created_by` within one
  company, and an index on `created_by` is added. Company sizes are in the hundreds.
- [Admins cannot see the owner's direct branch] → This follows the product owner's wording; it is
  noted in the PR so it can be widened later if wanted.
