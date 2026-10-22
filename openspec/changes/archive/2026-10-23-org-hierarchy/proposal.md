# Proposal: Organisation hierarchy

## Why

Developer companies are organised as a hierarchy, set out by the product owner on 2026-10-23:
- Invespy onboards the developer.
- The developer's super admin (the company owner) creates **admins**, and can also create
  **department heads** directly.
- Admins create department heads.
- Department heads build **teams** of members.

Visibility follows the hierarchy:
- the owner sees everyone;
- admins see each other and the users they (transitively) created;
- department heads see their departments' people;
- team members see their own teams.
A user can be in several teams. The hierarchy decides who creates and sees whom. Roles and
permissions decide which modules and actions a user can use. The two stay separate.

## What Changes

- **Levels:** every tenant user gets a `level`: `owner`, `admin`, `department_head` or `member`.
  Existing owners become `owner` and everyone else `member`. `AuthUser`, the `Actor` and
  `TenantUser` expose it, and `TenantUser` also lists the user's `teams`.
- **Who may create which level:**
  - the owner may create `admin`, `department_head` and `member`;
  - an admin may create `department_head` and `member`;
  - a department head may create `member`;
  - a member may create nobody.
  This is on top of `users.create`, and the same rule applies to changing a level.
- **Departments:** `departments.view|create|edit|delete`. Owners and admins create, edit and
  deactivate departments and choose each department's head, a `department_head` user. A department
  with active teams cannot be deactivated (409 `DEPARTMENT_HAS_TEAMS`).
- **Teams:** `teams.view|create|edit|delete`. A team belongs to one department. Owners and admins
  manage any team; a department head manages the teams of the departments they head. Members are
  added and removed per team, and a user can be in many teams. A team with members cannot be
  deactivated (409 `TEAM_HAS_MEMBERS`).
- **Visibility:**
  - `GET /users` and `GET /users/{id}` return only the users the caller may see; others are 404;
  - user management actions apply only to visible users;
  - departments and teams lists follow the same scoping.
- The catalogue gains the `departments` and `teams` modules. The owner holds them automatically.

## Capabilities

### New Capabilities
- `org-hierarchy`: covers user levels, who may create which level, and hierarchy-based visibility of
  users.
- `departments-and-teams`: covers departments with heads, teams inside departments, and team
  membership.

### Modified Capabilities
- `permission-catalogue`: the catalogue grows to include the `departments` and `teams` modules.
- `tenant-users`: `TenantUser` gains `level` and `teams`; creating and listing users respects the
  hierarchy.

## Impact

- **Frontend (UI changes allowed by the product owner for this):**
  - the users form gains a level selector and optional teams;
  - new Departments and Teams pages;
  - navigation entries;
  - the roles "Delete" label becomes "Deactivate".
  These are done locally in `crm-developer-ui` (never pushed).
- **Code:**
  - `migrations/0007_org_hierarchy.sql`;
  - the `Department` and `Team` aggregates, plus `User` level rules;
  - the `orgstructure` module;
  - visibility SQL;
  - catalogue seed entries.
