# Spec Delta

## Purpose

Lets a company group its people into departments, each led by a department head, and departments
into teams of members. A user may belong to several teams.

## ADDED Requirements

### Requirement: Department shape and listing
A `Department` SHALL be `{ id, name, head: { id, firstName, lastName, email } | null, teamCount, memberCount, createdAt }`.
`GET /api/v1/departments` (needs `departments.view`) lists active departments by name, with `meta`.
- owners and admins see all departments;
- department heads see the departments they head;
- members see the departments of their teams.

#### Scenario: Head sees own departments
- **WHEN** a head of "Finance" lists departments in a company that also has "HR"
- **THEN** only "Finance" is listed

### Requirement: Manage departments
Only owners and admins SHALL create (`departments.create`), rename or change the head of
(`departments.edit`), and deactivate (`departments.delete`) departments. Others are 403
`FORBIDDEN_OPERATION`. The name is 2–100 characters and unique among the company's active
departments (409 `DEPARTMENT_NAME_CONFLICT`).

#### Scenario: Create with a head
- **WHEN** the owner creates "Finance" with head H, a department head
- **THEN** the API answers 201 with `head.id` H and zero counts

### Requirement: Department head and deactivation
A department's head SHALL be an active `department_head` of the company that the caller may see (422
on `headUserId` otherwise). Deactivating a department that still has active teams is 409
`DEPARTMENT_HAS_TEAMS`; otherwise it answers `data: null`.

#### Scenario: Has teams
- **WHEN** the department still has an active team
- **THEN** deactivating it answers 409 `DEPARTMENT_HAS_TEAMS`

#### Scenario: Head must be a department head
- **WHEN** the head is a `member`
- **THEN** the API answers 422 with a detail for `headUserId`

### Requirement: Team shape and listing
A `Team` SHALL be `{ id, name, department: { id, name }, members: [{ id, firstName, lastName, email }], createdAt }`.
`GET /api/v1/teams` (needs `teams.view`, optional `departmentId`) lists active teams by name.
- owners and admins see all teams;
- department heads see the teams of their departments;
- members see their own teams.

#### Scenario: Member sees own teams
- **WHEN** a member of teams T1 and T2 lists teams
- **THEN** exactly T1 and T2 are listed with their members

### Requirement: Manage teams
`POST /api/v1/teams` with `{ departmentId, name }` (`teams.create`), `PATCH /api/v1/teams/{id}`
`{ name }` (`teams.edit`) and `DELETE /api/v1/teams/{id}` (`teams.delete`) SHALL be allowed to
owners and admins for any department, and to a department head only for departments they head.
Anyone else is 403 `FORBIDDEN_OPERATION`. The name is unique within its department (409
`TEAM_NAME_CONFLICT`). Deleting a team with members is 409 `TEAM_HAS_MEMBERS`.

#### Scenario: Head creates a team
- **WHEN** the head of "Finance" creates team "Payables" in Finance
- **THEN** the API answers 201

#### Scenario: Head of another department
- **WHEN** that head creates a team in "HR"
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

### Requirement: Team membership
`POST /api/v1/teams/{id}/members` with `{ userId }` and `DELETE /api/v1/teams/{id}/members/{userId}`
(both `teams.edit`, with the same department scope) SHALL add or remove a member and answer with the
`Team`. The user must be an active, non-owner user of the company that the caller may see (422 on
`userId` otherwise). Adding an existing member changes nothing, and a user may be in many teams.

#### Scenario: Add to two teams
- **WHEN** member M is added to teams T1 and T2
- **THEN** both teams list M, and M's `TenantUser.teams` lists both
