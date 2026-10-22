# Spec Delta

## Purpose

Lets Invespy platform operators see, onboard, suspend and reactivate developer companies (tenants)
from the platform console.

## ADDED Requirements

### Requirement: Platform-only access
Every `/api/v1/platform/*` endpoint SHALL require a platform user. A tenant user SHALL be answered
with 403 `PERMISSION_DENIED`, and an anonymous caller with 401 `UNAUTHENTICATED`.

#### Scenario: Tenant user calls the console
- **WHEN** a tenant user calls `GET /api/v1/platform/developers`
- **THEN** the API answers 403 `PERMISSION_DENIED`

### Requirement: Developer shape
A `Developer` SHALL be `{ id, name, slug, status, createdAt, userCount, superUser }`:
- `status` is `active` or `suspended`;
- `userCount` counts every user of the company, owner included;
- `superUser` is `{ id, email, name }` (name = first and last name), or `null` when the company has
  no owner.

#### Scenario: Owner described
- **WHEN** a company with an owner Sara Khan and two other users is returned
- **THEN** `userCount` is 3 and `superUser.name` is `Sara Khan`

### Requirement: List developers
`GET /api/v1/platform/developers` SHALL return `Developer[]` with `meta`, newest first. It accepts
`status` (`active`/`suspended`), and `search`, which matches the name, the slug and the owner's email,
first name and last name, case-insensitively.

#### Scenario: Search by owner email
- **WHEN** the operator searches `owner@skyline`
- **THEN** only the company whose owner has that email is returned

#### Scenario: Status filter
- **WHEN** the operator lists with `status=suspended`
- **THEN** only suspended companies are returned

### Requirement: Developer detail
`GET /api/v1/platform/developers/{id}` SHALL return the `Developer`. An unknown id is 404 `NOT_FOUND`.

#### Scenario: Unknown company
- **WHEN** the id does not exist
- **THEN** the API answers 404 `NOT_FOUND`

### Requirement: Manual onboarding
`POST /api/v1/platform/developers` with `{ name, slug, superUser: { email, firstName, lastName } }`
SHALL answer 201 with `{ developer, superUser: { id, email }, temporaryPassword }`. It creates the
company, its system role `developer_super_user`, and the owner holding that role, whose password must
be reset at first login. The temporary password is returned only in this response.

#### Scenario: Onboard
- **WHEN** an operator onboards "Palm Estates" with slug `palm-estates` and owner `owner@palm.example.com`
- **THEN** the API answers 201, and that owner can log in with the temporary password and is told `mustResetPassword: true`

### Requirement: Onboarding validation
Name (2–120 characters), slug (2–40 characters of lowercase letters, digits and single hyphens), owner
email and owner names SHALL be validated together as 422 `VALIDATION_FAILED`, with dot-notation fields
(`superUser.email`). A reserved slug is 422 `SLUG_RESERVED`. A slug already used by a company, or by a
live pending invite, is 409 `SLUG_CONFLICT`. An email already registered is 409 `EMAIL_CONFLICT`.

#### Scenario: Several bad fields
- **WHEN** the name is empty and the owner email is invalid
- **THEN** the API answers 422 with details for `name` and `superUser.email`

#### Scenario: Reserved slug
- **WHEN** the slug is `admin`
- **THEN** the API answers 422 `SLUG_RESERVED`

#### Scenario: Taken slug
- **WHEN** the slug belongs to an existing company
- **THEN** the API answers 409 `SLUG_CONFLICT`

#### Scenario: Taken email
- **WHEN** the owner email already has an account
- **THEN** the API answers 409 `EMAIL_CONFLICT`

### Requirement: Suspend and reactivate
`POST /api/v1/platform/developers/{id}/suspend` and `/reactivate` SHALL set the status and answer 200
with the `Developer`. Both are idempotent. Suspension locks every user of the company out on their
next request. Reactivation restores access without new logins.

#### Scenario: Suspend
- **WHEN** an operator suspends an active company
- **THEN** the API answers 200 with `status: suspended`, and the company's signed-in users get 403 `ORGANIZATION_SUSPENDED`

#### Scenario: Suspend twice
- **WHEN** an operator suspends an already suspended company
- **THEN** the API answers 200 with `status: suspended`, and no second activity entry is recorded
