# Design: Platform console

## Context

See proposal.md. Auth, the `Actor` and the identity tables (`organizations`, `users`,
`user_credentials`, `roles`, `user_roles`, `user_sessions`) exist. Exact frontend behaviour comes from
`crm-developer-ui/src/mocks/handlers.ts` (platform section) and `src/features/platform/schemas.ts`
(slug 2–40 characters, names 2–120, person names 1–60).

## Goals / Non-Goals

**Goals:** every platform screen and the accept-invite page work against the API.

**Non-Goals:**
- Tenant RBAC, the permission catalogue and the hierarchy (later changes). The owner role created here
  carries no permission rows; the RBAC change makes the owner hold the whole catalogue.
- Real email (decision: outbox and console only).
- Projects and units counts in stats. These are 0 until the projects change, which updates the stats
  query.

## Decisions

### D1. Schema (`migrations/0003_platform_console.sql`)
| Table | Columns | Constraints / indexes |
| ----- | ------- | --------------------- |
| `invites` | `id uuid`, `email citext`, `first_name varchar(100)`, `last_name varchar(100)`, `organization_name varchar(120)`, `slug citext`, `token_hash char(64)`, `status varchar(20) default 'pending'` (`pending`/`accepted`/`revoked`; `expired` is derived), `expires_at`, `invited_by uuid` → users, `accepted_at?`, `created_at`, `updated_at` | `UNIQUE(token_hash)`; idx `(status, created_at)`, `email`, `slug` |
| `audit_logs` | `id uuid`, `actor_user_id uuid?` → users, `action varchar(100)`, `entity_type varchar(100)`, `entity_id uuid?`, `organization_id uuid?` → organizations, `old_values jsonb?`, `new_values jsonb?`, `ip varchar(64)?`, `created_at` | idx `created_at DESC`, `(organization_id, created_at DESC)`, `action`; a trigger raises on `UPDATE`/`DELETE` (append-only) |
| `mail_outbox` | `id uuid`, `to_email citext`, `subject varchar(200)`, `body text`, `created_at`, `sent_at?` | idx `created_at` |

### D2. Aggregates
- `Organization` (`domain/aggregates/OrganizationAggregate/Organization.ts`):
  - `create({ name, slug, createdBy })` guards the name (2–120 characters, trimmed) and the slug
    (lowercased, the regex, 2–40 characters). A reserved slug raises 422 `SLUG_RESERVED` on `slug`
    (D5);
  - `suspend()` / `reactivate()` return whether anything changed, which makes them idempotent.
- `User` gains `createTenantOwner(...)`, `createPlatformAdmin(...)` and `deactivate()`, with name
  guards (1–100 characters).
- `Invite` (`domain/aggregates/InviteAggregate/Invite.ts`):
  - `issue(...)`;
  - `effectiveStatus(now)`, which derives `expired`;
  - `renew(tokenHash, expiresAt)` (pending or expired, else `ConflictError INVITE_NOT_PENDING`);
  - `revoke()` (stored status `pending`, expired or not, as in the mock; else `INVITE_NOT_PENDING`);
  - `accept()`.

### D3. Write side
| Repository | Methods |
| ---------- | ------- |
| `IOrganizationRepository` | `save(org, tx)`, `update(org, tx)`, `findById`, `slugTaken(slug)` (a company, or a live pending invite) |
| `IUserRepository` (extended) | `save(user, tx)`, `update(user, tx)`, `emailTaken(email)`, `assignRole(userId, roleId, assignedBy, tx)`, `countActivePlatformSuperUsers(exceptUserId)` |
| `IRoleRepository` | `createOwnerRole(organizationId, tx) → roleId`, `findPlatformRoleId(code)` |
| `IInviteRepository` | `save`, `update`, `findById`, `findByTokenHash`, `livePendingExists(email)` |
| `IAuditLog` | `record(entry, tx?)`: an allow-list per action plus redaction of keys matching `/password|token|hash|secret/i` |
| `IMailer` | `send({ to, subject, text })`: inserts into `mail_outbox` and logs `[mail] to <email>: <subject>`. The link is logged so that local runs can follow it. |

Onboarding, acceptance and admin creation run inside `IUnitOfWork.run`, so a failure leaves nothing
behind.

### D4. Read side
| Queries | Methods |
| ------- | ------- |
| `IDeveloperQueries` | `findList({ search, status, page })` and `findById(id)`. One SQL statement with a correlated `userCount` and a `LEFT JOIN` on the owner (the holder of the company's `developer_super_user` role); `search` uses `ILIKE` over the name, slug, owner email, first name and last name. |
| `IInviteQueries` | `findList({ status, page })`: the derived status in SQL (`CASE WHEN status='pending' AND expires_at < now() THEN 'expired' ELSE status END`), filtered on that expression. |
| `IPlatformAdminQueries` | `findList(page)` and `findById`: platform users with `role` = `platform_super_user` if they hold it, else `platform_admin`, and `isActive = status = 'active'`. Ordered by `created_at`. |
| `IPlatformStatsQueries` | `getStats(weeks)`: raw SQL with `replacements`, using `generate_series(date_trunc('week', now()) - (N-1) weeks …)`, which gives Monday weeks. Activity comes from `audit_logs` (`developer.onboarded` and `invite.accepted` → `organization.created`, `developer.suspended` → `organization.suspended`, `developer.reactivated` → `organization.reactivated`). |
| `IAuditQueries` | `findList({ action, entityType, organizationId, page })` |

### D5. Validation and error codes
- **Request DTOs** (class-validator) carry the frontend's limits:
  - `name` 2–120 characters;
  - `slug` 2–40 characters matching `^[a-z0-9]+(-[a-z0-9]+)*$`;
  - `email` `IsEmail`, at most 254 characters;
  - `firstName` and `lastName` 1–100 characters;
  - nested `superUser` via `ValidateNested`.
  So every bad field comes back in one 422 with dot paths.
- **Reserved slugs** (`admin, api, app, platform, www, login, support, invespy`) are checked in the
  handler after shape validation and answer 422 `SLUG_RESERVED`, as a `ValidationFailedError`
  subclass carrying that code. `AppError` gets an optional code override, so
  `new ValidationFailedError(details, message, 'SLUG_RESERVED')` keeps the field detail.
- **Conflicts:** a slug held by a company or a live pending invite → 409 `SLUG_CONFLICT`. An email
  with an account → 409 `EMAIL_CONFLICT`. A live invite for the email → 409 `INVITE_PENDING`.
- **Plane checks:** `application/common/Authorization.ts` provides
  `requirePlatform(actor)` (403 `PERMISSION_DENIED`) and `requirePlatformSuperUser(actor)`. Tenant
  helpers come with the RBAC change.

### D6. Invite tokens and links
`shared/utils/SecureToken.ts` provides `newSecureToken()` (32 random bytes, base64url) and
`hashToken()` (SHA-256 hex). Invites expire 7 days after they are issued or renewed. The link is
`${APP_BASE_URL}/accept-invite/${token}`. Public routes answer 404 `INVITE_INVALID` for any bad token
without saying why.

### D7. Accept flow (public)
In one transaction: re-check the invite (`FOR UPDATE`); check the slug and email again (409); create
the organization (`created_by` NULL), its owner role, the user and credential (`must_reset=false`) and
the role link; mark the invite accepted; and write the audit entry `invite.accepted` (actor NULL).
After the commit, `SessionIssuer.start` (exported by `AuthModule`) returns the `AuthSession`.

### D8. Temporary passwords
`shared/utils/TemporaryPassword.ts` → `Tmp-xxxxx-xxxxx-xxxxx`: 15 random alphanumeric characters,
plus the prefix and hyphens, so 21 characters in all. That satisfies the 12-character policy. It
appears only in the 201 response.

### D9. Modules and routes
| Module (`application/modules/…`) | Features | Controller |
| -------------------------------- | -------- | ---------- |
| `developer` | `getdevelopers`, `getdeveloper`, `onboarddeveloper`, `changedeveloperstatus` (suspend and reactivate share one slice) | `PlatformDevelopersController` → `platform/developers` |
| `invite` | `getinvites`, `issueinvite`, `resendinvite`, `revokeinvite`, `previewinvite`, `acceptinvite` | `PlatformInvitesController` → `platform/invites`; `PublicInvitesController` → `public/invites` (`@Public`) |
| `platformadmin` | `getplatformadmins`, `createplatformadmin`, `deactivateplatformadmin` | `PlatformAdminsController` → `platform/admins` |
| `platforminsights` | `getplatformstats`, `getauditlog` | `PlatformInsightsController` → `platform/stats`, `platform/audit` |

A `PlatformPersistenceModule` binds all the repositories and queries above. The mail and audit
writers live in `infrastructure/{mail,audit}`.

## Risks / Trade-offs

- [Owner lookup by role code `developer_super_user`] → One system role per company with a unique
  `(organization_id, code)`, so the join is cheap and unambiguous.
- [Stats computed live] → A handful of aggregate queries on indexed columns. That is fine at console
  scale, and there is nothing to keep in sync.
- [The console mailer only logs] → By decision. `IMailer` is the seam for SMTP later.

## Migration Plan

Run `npm run db:migrate`. No backfill is needed.
