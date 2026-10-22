---
document_type: Feature Specification
status: Draft
title: CRM User Management and Access Control
version: 1.0
---

# CRM User Management and Access Control

## 1. Purpose

Define the functional requirements, PostgreSQL data model,
relationships, authorization rules, and acceptance criteria for the
CRM's User Management and Role-Based Access Control (RBAC) module.

This document is intended to be used as a source of truth in spec-driven
development and AI/agent-driven development. Implementations must follow
this specification unless an approved change updates it.

## 2. Scope

### In scope

-   Manage CRM users and their status.
-   Classify users by user type.
-   Create and manage roles.
-   Define modules and their available permissions.
-   Assign one or more roles to a user.
-   Assign permissions to roles.
-   Enforce permissions on the backend API.
-   Support record-level access policies.
-   Audit sensitive user and access-control changes.
-   Provide database migrations, seed data, APIs, UI, and automated
    tests.

### Out of scope unless separately specified

-   Building a complete authentication provider.
-   Defining organization/tenant administration in detail.
-   Business-specific lead, contact, project, or sales workflows.
-   Fine-grained field-level security.
-   A custom policy language.

## 3. Terminology

  -----------------------------------------------------------------------
  Term                                Definition
  ----------------------------------- -----------------------------------
  User                                An account that can authenticate to
                                      the CRM.

  User Type                           Business classification, such as
                                      Internal Staff, Partner, or
                                      Customer. It does not grant
                                      permissions by itself.

  Role                                A named collection of permissions,
                                      such as Admin, Sales Manager, or
                                      Viewer.

  Module                              A functional area such as Leads,
                                      Projects, Reports, or User
                                      Management.

  Permission                          A specific action on a module, such
                                      as `leads.read` or `leads.create`.

  RBAC                                Role-Based Access Control:
                                      permissions are assigned to roles,
                                      then roles are assigned to users.

  Record-level access                 A rule restricting which records a
                                      user can access, such as assigned
                                      records or team records.

  Audit log                           A record of sensitive actions and
                                      changes for accountability.
  -----------------------------------------------------------------------

## 4. Functional Requirements

### FR-001: User management

An authorized administrator must be able to create, view, update,
activate, deactivate, and assign roles to users.

-   Email must be unique after normalization.
-   A deactivated or suspended user must not be allowed to access
    protected CRM functionality.
-   Prefer deactivation over hard deletion when historical business
    records reference the user.
-   Passwords must never be stored in plaintext. If an external identity
    provider is used, store its stable subject identifier rather than a
    local password hash.

### FR-002: User types

An authorized administrator must be able to maintain user types.

Examples: `INTERNAL_STAFF`, `PARTNER`, `CUSTOMER`.

User type is classification only. It must not implicitly grant
permissions.

### FR-003: Role management

An authorized administrator must be able to create, view, update, and
deactivate roles, subject to safeguards for protected system roles.

Examples: `SUPER_ADMIN`, `ADMIN`, `SALES_MANAGER`, `SALES_AGENT`,
`VIEWER`.

### FR-004: Module and permission catalogue

The system must maintain a catalogue of modules and the actions
available in each module.

Suggested standard actions:

-   `create`
-   `read`
-   `update`
-   `delete`
-   `export`
-   `approve`
-   `assign`

Only actions applicable to a module need to be created. Permission codes
must be stable and unique, for example `leads.read`.

### FR-005: Role-permission assignment

An authorized administrator must be able to grant and revoke permissions
for roles. Changes must be persisted transactionally and take effect
promptly.

### FR-006: User-role assignment

A user may have multiple roles. The system must record who assigned a
role and when it was assigned.

### FR-007: Authorization enforcement

The backend must authorize every protected API operation. Hiding a
frontend button is not sufficient security.

For each request, the backend must: 1. Authenticate the caller. 2.
Confirm the account is active. 3. Resolve the caller's roles and
permissions. 4. Check the permission required by the operation. 5. Apply
record-level and tenant/organization restrictions, if applicable. 6.
Allow the operation or return an appropriate access-denied response. 7.
Audit sensitive actions.

### FR-008: Record-level access

Business modules should be able to apply one of these policies:

-   `ALL`: all records in the permitted scope.
-   `TEAM`: records belonging to the user's team.
-   `ASSIGNED`: records assigned to the user.
-   `OWN`: records owned or created by the user.

Module permission and record-level scope are separate checks. A user who
has `leads.read` may still be restricted to assigned leads.

### FR-009: Audit logging

Record sensitive events, including user activation/deactivation, role
assignment changes, role-permission changes, and other privileged
actions.

Do not store passwords, access tokens, or other secrets in audit logs.
Apply appropriate retention and privacy rules.

### FR-010: Least privilege

New users must receive no unnecessary access. Access should be granted
through explicit role assignments and permission grants.

### FR-011: Administrator safeguards

-   Prevent removal or deactivation of the last active Super Admin.
-   Protect system-critical roles and permissions from accidental
    deletion.
-   Restrict role and permission administration to explicitly authorized
    users.
-   Revoke access promptly when a user is suspended or their roles are
    removed.

## 5. Example Permission Matrix

This matrix is illustrative. Final grants must be confirmed by the
product owner.

  --------------------------------------------------------------------------
  Module         Super Admin    Sales Manager  Sales Agent    Viewer
  -------------- -------------- -------------- -------------- --------------
  User           Full access    Read, if       No access      No access
  Management                    approved                      

  Leads          Full access    Read, create,  Read/update    Read permitted
                                update, assign assigned       records
                                               records        

  Projects       Full access    Read/update,   Read           Read
                                if approved                   

  Reports        Full access    Read/export    Read own       Read
                                               reports        

  Roles &        Full access    No access      No access      No access
  Permissions                                                 
  --------------------------------------------------------------------------

Do not hard-code this matrix into application logic. Store grants in the
database and manage them through authorized administration.

## 6. PostgreSQL Data Model

Use UUID primary keys, foreign keys, uniqueness constraints, and
timestamps. Choose UUID generation based on the project's existing
PostgreSQL conventions.

### 6.1 `user_types`

Purpose: classify users.

  Column          Type           Constraints / Notes
  --------------- -------------- ------------------------
  `id`            UUID           Primary key
  `code`          VARCHAR(50)    Unique, stable code
  `name`          VARCHAR(100)   Required
  `description`   TEXT           Nullable
  `is_active`     BOOLEAN        Required, default true
  `created_at`    TIMESTAMPTZ    Required
  `updated_at`    TIMESTAMPTZ    Required

### 6.2 `users`

Purpose: store CRM account details.

  Column                Type           Constraints / Notes
  --------------------- -------------- ---------------------------------------
  `id`                  UUID           Primary key
  `user_type_id`        UUID           FK to `user_types.id`
  `first_name`          VARCHAR(100)   Required
  `last_name`           VARCHAR(100)   Nullable if business rules allow
  `email`               VARCHAR(255)   Required; unique after normalization
  `password_hash`       TEXT           Nullable when using external identity
  `identity_provider`   VARCHAR(100)   Nullable
  `identity_subject`    VARCHAR(255)   Nullable; external identity key
  `status`              VARCHAR(20)    Constrained to approved states
  `last_login_at`       TIMESTAMPTZ    Nullable
  `created_at`          TIMESTAMPTZ    Required
  `updated_at`          TIMESTAMPTZ    Required
  `deactivated_at`      TIMESTAMPTZ    Nullable

Use a unique index on normalized email, according to the application's
email normalization policy. If external identity is used, enforce
uniqueness for the provider/subject pair.

### 6.3 `roles`

Purpose: define named collections of permissions.

  Column             Type           Constraints / Notes
  ------------------ -------------- -------------------------
  `id`               UUID           Primary key
  `code`             VARCHAR(50)    Unique, stable code
  `name`             VARCHAR(100)   Required
  `description`      TEXT           Nullable
  `is_system_role`   BOOLEAN        Required, default false
  `is_active`        BOOLEAN        Required, default true
  `created_at`       TIMESTAMPTZ    Required
  `updated_at`       TIMESTAMPTZ    Required

### 6.4 `modules`

Purpose: catalogue functional modules and optional submodules.

  Column               Type           Constraints / Notes
  -------------------- -------------- -----------------------------
  `id`                 UUID           Primary key
  `code`               VARCHAR(100)   Unique, stable code
  `name`               VARCHAR(100)   Required
  `parent_module_id`   UUID           Nullable FK to `modules.id`
  `description`        TEXT           Nullable
  `is_active`          BOOLEAN        Required, default true

### 6.5 `permissions`

Purpose: define an action on a module.

  Column          Type           Constraints / Notes
  --------------- -------------- ---------------------------
  `id`            UUID           Primary key
  `module_id`     UUID           FK to `modules.id`
  `code`          VARCHAR(150)   Unique, e.g. `leads.read`
  `name`          VARCHAR(100)   Required
  `description`   TEXT           Nullable
  `created_at`    TIMESTAMPTZ    Required

### 6.6 `user_roles`

Purpose: many-to-many mapping between users and roles.

  Column          Type          Constraints / Notes
  --------------- ------------- ---------------------------
  `user_id`       UUID          FK to `users.id`
  `role_id`       UUID          FK to `roles.id`
  `assigned_by`   UUID          Nullable FK to `users.id`
  `assigned_at`   TIMESTAMPTZ   Required

Primary key: (`user_id`, `role_id`).

### 6.7 `role_permissions`

Purpose: many-to-many mapping between roles and permissions.

  Column            Type          Constraints / Notes
  ----------------- ------------- ---------------------------
  `role_id`         UUID          FK to `roles.id`
  `permission_id`   UUID          FK to `permissions.id`
  `granted_by`      UUID          Nullable FK to `users.id`
  `granted_at`      TIMESTAMPTZ   Required

Primary key: (`role_id`, `permission_id`).

### 6.8 `audit_logs`

Purpose: retain an audit trail of sensitive actions.

  -----------------------------------------------------------------------
  Column                  Type                    Constraints / Notes
  ----------------------- ----------------------- -----------------------
  `id`                    UUID                    Primary key

  `actor_user_id`         UUID                    Nullable FK to
                                                  `users.id`; preserve
                                                  logs if account is
                                                  deleted

  `action`                VARCHAR(100)            Required

  `entity_type`           VARCHAR(100)            Required

  `entity_id`             UUID                    Nullable

  `old_values`            JSONB                   Nullable; redact
                                                  secrets

  `new_values`            JSONB                   Nullable; redact
                                                  secrets

  `ip_address`            INET                    Nullable, subject to
                                                  privacy policy

  `created_at`            TIMESTAMPTZ             Required
  -----------------------------------------------------------------------

## 7. Entity Relationships

``` mermaid
erDiagram
    USER_TYPES ||--o{ USERS : classifies
    USERS ||--o{ USER_ROLES : receives
    ROLES ||--o{ USER_ROLES : assigned
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : included
    MODULES ||--o{ PERMISSIONS : contains
    MODULES o|--o{ MODULES : parent_of
    USERS o|--o{ AUDIT_LOGS : performs

    USER_TYPES {
        uuid id PK
        varchar code UK
    }
    USERS {
        uuid id PK
        uuid user_type_id FK
        varchar email UK
        varchar status
    }
    ROLES {
        uuid id PK
        varchar code UK
    }
    USER_ROLES {
        uuid user_id PK, FK
        uuid role_id PK, FK
    }
    MODULES {
        uuid id PK
        uuid parent_module_id FK
        varchar code UK
    }
    PERMISSIONS {
        uuid id PK
        uuid module_id FK
        varchar code UK
    }
    ROLE_PERMISSIONS {
        uuid role_id PK, FK
        uuid permission_id PK, FK
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_user_id FK
        varchar action
    }
```

Relationship rules:

1.  One user type can classify many users.
2.  Users and roles are many-to-many through `user_roles`.
3.  Roles and permissions are many-to-many through `role_permissions`.
4.  Each permission belongs to one module.
5.  A module can have child modules.
6.  A user can perform many audited actions.

## 8. API and UI Expectations

Proposed API capabilities (adapt names and conventions to the existing
application):

-   Users: list, detail, create, update, activate/deactivate,
    assign/remove roles.
-   User types: list and administer types.
-   Roles: list, detail, create, update, deactivate.
-   Modules and permissions: read catalogue; administer only when
    explicitly required.
-   Role permissions: view, grant, revoke.
-   Audit logs: authorized, filtered, paginated read access.

The UI should show only actions the current user is allowed to perform,
while the backend remains the source of authorization truth.

## 9. Non-Functional Requirements

-   Use database transactions for multi-table role and permission
    changes.
-   Add indexes for foreign keys and frequently queried authorization
    paths.
-   Use pagination and filtering for user and audit-log lists.
-   Avoid querying the database repeatedly for every permission check
    where safe caching is possible; invalidate or refresh caches after
    access changes.
-   Return consistent HTTP status codes, including `401` for
    unauthenticated requests and `403` for authenticated users lacking
    permission.
-   Apply project-standard logging, error handling, migration, linting,
    and testing practices.
-   Never trust role IDs, permission codes, or user IDs supplied by the
    frontend without server-side validation.

## 10. Acceptance Criteria

-   An authorized administrator can manage users and assign multiple
    roles.
-   An authorized administrator can manage roles and their permissions.
-   User type does not implicitly grant permissions.
-   Protected APIs reject requests when the user lacks the required
    permission.
-   Record-level restrictions are enforced in the backend.
-   Inactive or suspended users cannot access protected functionality.
-   The system prevents removal of the last active Super Admin.
-   Permission changes become effective within the agreed cache
    invalidation window.
-   Sensitive access-control changes are audited.
-   Database migrations, seed scripts, and automated tests are included.
-   Tests cover both successful and denied operations.

## 11. Decisions Required Before Implementation

Do not guess these project-specific decisions. Confirm them or document
an explicit default before coding:

1.  **Authentication:** local password authentication, existing SSO, or
    an identity provider such as Keycloak?
2.  **Multiple roles:** can one user hold multiple roles? Proposed
    default: yes.
3.  **Organization model:** is the CRM single-company or multi-tenant?
    If multi-tenant, scope users, roles, assignments, and records to an
    organization as appropriate.
4.  **Record access:** which modules require all/team/assigned/own
    scopes?
5.  **Deletion policy:** soft-delete or deactivate users and roles?
    Proposed default: deactivate.
6.  **System roles:** which roles are protected, and who can assign
    them?
7.  **Permission changes:** what is the required cache invalidation and
    session-refresh behavior?
8.  **Existing schema:** reuse current users, roles, permissions, and
    naming conventions where present; do not create duplicate tables
    without reviewing the existing database.

## 12. Instructions for AI/Agent-Driven Implementation

Treat this file as the feature specification, not as permission to
modify production systems immediately.

Before implementation, the agent must:

1.  Inspect the existing repository, architecture, authentication,
    database schema, migrations, and API conventions.
2.  Identify existing tables or functionality that can be reused.
3.  Report conflicts, missing decisions, and proposed changes before
    making destructive changes.
4.  Produce a concise implementation plan and task breakdown.
5.  Implement database migrations and seed data before dependent API and
    UI changes.
6.  Enforce authorization server-side and add negative tests for
    forbidden operations.
7.  Run applicable tests, linting, type checks, and migration
    validation.
8.  Update API documentation and this specification if an approved
    design decision changes.
9.  Summarize changed files, migration steps, test results, assumptions,
    and remaining risks.
10. Never deploy to production, delete production data, or change
    production access controls without explicit approval.

## 13. Definition of Done

The feature is complete only when the database, backend authorization,
UI, migrations, seed data, audit logging, automated tests, and
documentation are aligned with this specification and all acceptance
criteria pass.