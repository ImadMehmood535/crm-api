# platform-insights Specification

## Purpose
Gives platform operators an overview of the platform (counts, weekly trends, recent company activity)
and an append-only audit trail of sensitive console actions.

## Requirements

### Requirement: Dashboard counts
`GET /api/v1/platform/stats?weeks=N` (N between 1 and 26, default 8) SHALL answer
`{ counts, recentActivity, trends }`. `counts` is
`{ organizations: { total, active, suspended }, users: { total }, projects: { total }, units: { total } }`,
where `users.total` counts tenant users only.

#### Scenario: Counts
- **WHEN** there are two active companies, one suspended company, and five tenant users
- **THEN** `counts.organizations` is `{ total: 3, active: 2, suspended: 1 }` and `counts.users.total` is 5

#### Scenario: Out-of-range weeks
- **WHEN** `weeks=27`
- **THEN** the API answers 422 on `weeks`

### Requirement: Weekly trends
`trends.weeks` SHALL list N ISO weeks in ascending `weekStart` (`YYYY-MM-DD`, Monday) order, ending
with the current week. Each week has `newOrganizations` and `newUsers` (tenant users created in it).

#### Scenario: Default weeks
- **WHEN** an operator calls `GET /api/v1/platform/stats`
- **THEN** `trends.weeks` has 8 entries ending with the current week

### Requirement: Recent company activity
`recentActivity` SHALL hold up to 10 entries, newest first:
`{ type, organizationId, organizationName, at, actorName }`. `type` is `organization.created`,
`organization.suspended` or `organization.reactivated`. `actorName` is null when nobody was signed
in, as with an invite acceptance.

#### Scenario: Activity after onboarding
- **WHEN** an operator onboards a company and then suspends it
- **THEN** `recentActivity` starts with `organization.suspended` followed by `organization.created`, both naming the operator

### Requirement: Audit trail is append-only
Company onboarding, suspension and reactivation, invite issue, resend, revoke and acceptance, and
platform admin creation and deactivation SHALL each append an audit entry. Each entry holds the actor,
the action, the entity, the company, old and new values with secrets removed, the IP and the time.
Entries cannot be updated or deleted.

#### Scenario: Suspension audited
- **WHEN** an operator suspends a company
- **THEN** an entry `developer.suspended` exists for that company with the operator as actor, old status `active` and new status `suspended`

#### Scenario: No secrets
- **WHEN** an operator onboards a company
- **THEN** the audit entry's values contain no password or token

### Requirement: Audit listing
`GET /api/v1/platform/audit` (any platform user) SHALL list audit entries newest first with `meta`,
filterable by `action`, `entityType` and `organizationId`. Each entry is
`{ id, createdAt, action, entityType, entityId, organizationId, organizationName, actor, oldValues, newValues, ip }`,
where `actor` is `{ id, email, name }` or null.

#### Scenario: Filter by action
- **WHEN** an operator lists with `action=developer.suspended`
- **THEN** only suspension entries are returned
