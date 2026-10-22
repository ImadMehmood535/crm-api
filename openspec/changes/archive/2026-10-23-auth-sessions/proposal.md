# Proposal: Auth sessions

## Why

Every frontend screen sits behind a login. Without a real session model the frontend cannot reach any
business endpoint. The user asked for enterprise-grade authentication:
- a short-lived JWT access token;
- an opaque, rotating refresh token kept in an httpOnly cookie by the Next route handlers;
- silent refresh;
- forced password reset;
- immediate lock-out when a company is suspended.

## What Changes

- Identity tables and their migration: `organizations`, `users`, `user_credentials`, `roles`,
  `user_roles` and `user_sessions`.
- `POST /api/v1/auth/login` → `AuthSession`. It answers 401 `INVALID_CREDENTIALS` (the same answer for
  an unknown email and a wrong password, with equalised timing). Only after a correct password does it
  reveal 403 `ORGANIZATION_SUSPENDED` or 403 `ACCOUNT_INACTIVE`.
- `POST /api/v1/auth/refresh` → `AuthSession`:
  - the refresh token is single-use and rotating;
  - replaying a rotated token revokes the whole login chain;
  - a suspended company gives 403 `ORGANIZATION_SUSPENDED`.
- `POST /api/v1/auth/logout` revokes the caller's login chain.
- `POST /api/v1/auth/reset-password` sets a new password (≥ 12 characters, different from the current
  one), clears the must-reset flag, revokes every session and returns a new `AuthSession`.
- `GET /api/v1/auth/me` → `AuthUser`.
- A global authentication guard:
  - every route needs `Authorization: Bearer <access token>` unless it is public;
  - session, user and company state are re-checked on every request;
  - a user with a temporary password gets 403 `PASSWORD_RESET_REQUIRED` everywhere except me, logout
    and reset-password;
  - the caller is exposed to handlers as an `Actor`.
- A seed for the platform roles (`platform_super_user`, `platform_admin`) and the platform super user,
  whose details come from environment variables.

## Capabilities

### New Capabilities
- `auth-sessions`: covers login, token refresh with rotation and reuse detection, logout, forced and
  voluntary password reset, the current user, and request authentication (bearer token, per-request
  status checks, the must-reset gate).

### Modified Capabilities
- None.

## Impact

- **Frontend:**
  - `/login`;
  - session restore (`/api/auth/refresh`);
  - the axios single-flight refresh (`401 UNAUTHENTICATED`);
  - `/reset-password`;
  - `/suspended` (`403 ORGANIZATION_SUSPENDED`);
  - logout;
  - the `AuthGate` plane routing (`user.plane`, `roles`, `isSuperUser`, `permissions`).
  No UI change.
- **Code:**
  - `migrations/0002_identity_and_sessions.sql`;
  - the user, organization, role and session aggregates and models;
  - `src/infrastructure/security/*` (password hashing, access tokens);
  - `application/modules/auth`;
  - `api/controllers/AuthController.ts`, `api/guards/AuthGuard.ts`, `api/common/{Public,CurrentActor,…}.ts`;
  - `seeds/platform-identity.seed.ts`.
- **Dependencies:** `jsonwebtoken` (runtime) and `@types/jsonwebtoken` (dev). Password hashing uses
  Node's built-in `crypto.scrypt`, so no bcrypt dependency is needed.
- **Config:**
  - `JWT_ACCESS_SECRET` (required, at least 32 characters);
  - `ACCESS_TOKEN_TTL_SECONDS` (900);
  - `REFRESH_TOKEN_TTL_DAYS` (30);
  - `PLATFORM_SUPER_USER_EMAIL`, `PLATFORM_SUPER_USER_PASSWORD`, `PLATFORM_SUPER_USER_FIRST_NAME`,
    `PLATFORM_SUPER_USER_LAST_NAME`.
