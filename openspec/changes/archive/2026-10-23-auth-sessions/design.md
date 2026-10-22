# Design: Auth sessions

## Context

See proposal.md. The foundation (envelope, errors, migrator, unit of work) is in place.

The frontend never stores the refresh token in JavaScript. Its Next route handlers do the following:
- `login`, `refresh`, `reset-password` and `accept-invite` call this API, put `refreshToken` into the
  httpOnly cookie `invespy_rt` and strip it from the body;
- `logout` forwards the bearer token.

The browser keeps the access token in memory and refreshes once on `401 UNAUTHENTICATED`
(`crm-developer-ui/src/lib/api/client.ts`). The old API (`current/crm-developer-api`) is used only as
a behavioural reference.

## Goals / Non-Goals

**Goals:** the endpoints, guard and data model in the spec; the seeded platform super user; an
`Actor` that every later module consumes.

**Non-Goals:**
- Tenant RBAC tables and the permission catalogue (change `tenant-rbac`). Until then `permissions` is
  empty, except for the company owner (`developer_super_user`), who receives the catalogue once it
  exists.
- Onboarding and invites (change `platform-console`).
- Rate limiting (later, by decision).

## Decisions

### D1. Tables (`migrations/0002_identity_and_sessions.sql`)
| Table | Columns (all `NOT NULL` unless marked `?`) | Constraints / indexes |
| ----- | ------------------------------------------ | --------------------- |
| `organizations` | `id uuid`, `name varchar(120)`, `slug citext`, `status varchar(20) default 'active'`, `created_by uuid?`, `created_at`, `updated_at` | PK; `UNIQUE(slug)`; `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 40)` (the frontend's slug rule); `CHECK status IN ('active','suspended')`; idx `status`, `created_at` |
| `users` | `id`, `organization_id uuid?` → organizations, `email citext`, `first_name varchar(100)`, `last_name varchar(100)`, `status varchar(20) default 'active'`, `is_system bool default false`, `last_login_at timestamptz?`, `deactivated_at timestamptz?`, `created_by uuid?` → users, `created_at`, `updated_at` | `UNIQUE(email)` (emails are global, as login has no company field); `CHECK status IN ('active','inactive','suspended')`; idx `organization_id`, `status` |
| `user_credentials` | `user_id uuid` PK → users, `password_hash text`, `must_reset_password bool default false`, `password_updated_at timestamptz`, `created_at`, `updated_at` | one row per user |
| `roles` | `id`, `organization_id uuid?` → organizations, `code varchar(50)`, `name varchar(100)`, `description text?`, `is_system_role bool default false`, `is_active bool default true`, `created_at`, `updated_at` | unique `(organization_id, code)` for tenant roles and partial unique `(code) WHERE organization_id IS NULL` for platform roles; idx `organization_id` |
| `user_roles` | `user_id` → users, `role_id` → roles, `assigned_by uuid?` → users, `assigned_at timestamptz default now()` | PK `(user_id, role_id)`; idx `role_id` |
| `user_sessions` | `id`, `user_id` → users, `family_id uuid`, `refresh_token_hash char(64)`, `expires_at timestamptz`, `last_used_at timestamptz`, `revoked_at timestamptz?`, `revoked_reason varchar(30)?`, `replaced_by uuid?` → user_sessions, `ip_address varchar(64)?`, `user_agent varchar(255)?`, `created_at`, `updated_at` | `UNIQUE(refresh_token_hash)`; idx `user_id`, `family_id` |

`organizations.created_by` references `users` through an FK added after both tables exist. Every FK is
`ON DELETE RESTRICT`.

The password hash lives in its own table, so no user query can return it by accident.

### D2. Password hashing: Node `crypto.scrypt`
`src/infrastructure/security/ScryptPasswordHasher.ts` stores `scrypt$N$r$p$saltB64$hashB64` with
N=16384, r=8, p=1, a 16-byte salt and a 64-byte key. It compares with `timingSafeEqual`.
`dummyVerify()` hashes against a fixed hash, so that an unknown email takes the same time as a wrong
password.
- *Alternative:* bcrypt or argon2. Rejected: both add a native or JS dependency, while `scrypt` is
  built in and memory-hard.

### D3. Access token: JWT HS256 via `jsonwebtoken`
`src/infrastructure/security/JwtAccessTokens.ts`:
- claims: `sub` (user id), `sid` (the login chain, i.e. the session `family_id`), `iss=crm-developer-api`, `aud=crm-developer-ui`;
- lifetime `ACCESS_TOKEN_TTL_SECONDS` (900);
- `verify` pins `algorithms: ['HS256']` (rejecting `none` and algorithm confusion) and the issuer and
  audience.

The token carries no roles or tenant. Everything is resolved from the database on each request, so
changes take effect at once. The user chose no permission cache.

### D4. Refresh tokens and sessions
- The token is `randomBytes(32).toString('base64url')`. It is stored as SHA-256 hex. A fast hash is
  enough here, because the token has 256 bits of entropy.
- **Login** starts a new `family_id`.
- **Refresh** rotates. In one transaction it:
  1. locks the presented session row `FOR UPDATE`;
  2. checks that it is unrevoked, unreplaced and unexpired;
  3. inserts the successor with the same family;
  4. marks the old row `replaced_by` and `revoked_reason='rotated'`.
- A presented token whose row has `replaced_by` set means reuse. Every unrevoked session of that
  family is revoked with `'refresh_reuse'`, and the request answers 401.
- **Logout** revokes the family (`'logout'`). **Reset-password** revokes all of the user's sessions
  (`'password_changed'`) and opens a new family.
- **Suspension and deactivation** do not revoke sessions; the per-request check refuses them. So
  reactivation restores access with the same tokens, as the contract says.

### D5. Request authentication: global `AuthGuard` + `ResolveActorQuery`
- `src/api/guards/AuthGuard.ts` is registered as `APP_GUARD` in `ApiModule`. It skips handlers marked
  `@Public()`. Otherwise it:
  1. parses `Bearer <token>`;
  2. dispatches `ResolveActorQuery(token)` on the QueryBus;
  3. stores the `Actor` on the request;
  4. throws `ForbiddenError('PASSWORD_RESET_REQUIRED')` when `actor.mustResetPassword`, unless the
     handler is marked `@AllowWhenResetRequired()`.
- `ResolveActorQueryHandler` (application/modules/auth) verifies the JWT and checks that the login
  chain `sid` still has an unrevoked, unexpired session of user `sub`. Rotation keeps the chain alive,
  so an access token issued before a refresh stays valid until it expires; this avoids tabs that share
  the refresh cookie invalidating each other. Logout and password change revoke the chain, so its
  access tokens stop working at once. It then loads the account (`IAuthQueries.findAccount`), applies
  the access policy (D6) and returns the `Actor`.
- `@CurrentActor()` (`src/api/common/CurrentActor.ts`) reads `request.actor`.
- The guard lives in `api` and talks only to the QueryBus (R5). The JWT and DB logic stay in
  application and infrastructure.

### D6. Access policy (one function, used by login, refresh and the guard)
`src/application/modules/auth/AccessPolicy.ts` → `assertCanAuthenticate(userStatus, orgStatus | null)`:
- a company that is not active → `ForbiddenError('ORGANIZATION_SUSPENDED', 'This company account is suspended. Please contact Invespy.')`;
- otherwise a user that is not active → `ForbiddenError('ACCOUNT_INACTIVE', 'This account is not active.')`.

The company is checked first, so the suspended screen wins.

### D7. `Actor` and `AuthUser`
- `src/shared/auth/Actor.ts`:
  `{ userId, sessionId, organizationId: string | null, plane: 'platform' | 'tenant', roles: string[], permissions: string[], isSuperUser, mustResetPassword }`.
- `AuthUser` is built by `IAuthQueries.findAuthUser(userId)`, the same query as the principal, and
  mapped by one function so that login, refresh, me and the guard agree.
- The permissions rule lives in `src/shared/auth/permissions.ts` (`effectivePermissions`). Platform
  users get `[]`. A user holding `developer_super_user` gets the full catalogue. Others get the union
  of their roles' grants. Until the `tenant-rbac` change both lists are empty.

### D8. Module layout
- **Domain:**
  - `domain/aggregates/UserAggregate/{User.ts, UserModel.ts, UserCredentialModel.ts, UserRoleModel.ts}`;
  - `domain/aggregates/OrganizationAggregate/OrganizationModel.ts`;
  - `domain/aggregates/RoleAggregate/RoleModel.ts`;
  - `domain/aggregates/SessionAggregate/{Session.ts, SessionModel.ts}`.
  Only `User` and `Session` need behaviour now. `Organization` and `Role` gain aggregates in their
  own changes.
- **Infrastructure:**
  - `repositories/{IUserRepository,ISessionRepository}` and their implementations;
  - `queries/{IAuthQueries}/AuthQueries.ts`;
  - `security/abstraction/{IPasswordHasher,IAccessTokens}.ts`, `ScryptPasswordHasher.ts`,
    `JwtAccessTokens.ts`;
  - `persistence/AuthPersistenceModule.ts`.
- **Application:** `modules/auth/` with features `login`, `refresh`, `logout`, `resetpassword`,
  `getme` and `resolveactor`, plus a shared `SessionIssuer` helper inside the module that opens a
  session and builds the `AuthSession`. It is used by login, refresh, reset and later by
  accept-invite.
- **API:** `controllers/AuthController.ts`, `guards/AuthGuard.ts`,
  `common/{Public,AllowWhenResetRequired,CurrentActor}.ts`.

### D9. Request metadata
The IP address (first `X-Forwarded-For` entry, else the socket address) and the user agent are
recorded on sessions, truncated to the column widths. They are never used for decisions.

### D10. Seeds
`seeds/platform-identity.seed.ts` upserts the global roles `platform_super_user` and `platform_admin`
(system roles). If `PLATFORM_SUPER_USER_EMAIL` is set and no user has that email, it creates the user
(`is_system=true`), its credential (`must_reset_password=false`) and the role link. The password comes
from `PLATFORM_SUPER_USER_PASSWORD`, at least 12 characters, otherwise the seed fails. The seed never
overwrites an existing user's password.

## Risks / Trade-offs

- [One DB round-trip per request for the principal] → One indexed query by session id. The user chose
  no cache, and correctness (instant suspension) matters more here.
- [HS256 shared secret] → The secret is required and at least 32 characters, read from env and never
  logged. Moving to RS256 later only touches `JwtAccessTokens`.
- [Concurrent refreshes from two tabs] → The frontend single-flights per tab. Across tabs, the second
  refresh reads as reuse and signs the user out. This is the accepted behaviour of the contract (the
  refresh family is revoked on reuse).

## Migration Plan

Run `npm run db:migrate`, then `npm run db:seed` with the `PLATFORM_SUPER_USER_*` variables set.
