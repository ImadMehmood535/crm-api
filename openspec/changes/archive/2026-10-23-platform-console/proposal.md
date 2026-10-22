# Proposal: Platform console

## Why

Invespy operators run the business from the platform console. In the frontend these are the
`(platform)` screens: dashboard, developers, invites and platform admins. The console is also how a
developer company comes to exist, either by manual onboarding or through an invite that the company
accepts. None of these endpoints exist yet, so every console screen and the `/accept-invite/[token]`
page fail against the real API.

## What Changes

- **Developers (companies):**
  - `GET /api/v1/platform/developers` (search, status filter, pagination, newest first);
  - `GET /api/v1/platform/developers/{id}`;
  - `POST /api/v1/platform/developers`, which creates the company, its `developer_super_user` system
    role and its owner with a one-time temporary password (must reset);
  - `POST /api/v1/platform/developers/{id}/suspend` and `/reactivate` (idempotent).
- **Invites:**
  - `GET /api/v1/platform/invites` (status filter, with `expired` derived);
  - `POST /api/v1/platform/invites`, which logs the link through the mail outbox;
  - `POST /api/v1/platform/invites/{id}/resend` (pending or expired; renews the token and the expiry)
    and `/revoke` (pending only);
  - public `GET /api/v1/public/invites/{token}` and `POST /api/v1/public/invites/{token}/accept`,
    which provisions the company and its owner and logs them in (`AuthSession`).
- **Platform admins:**
  - `GET /api/v1/platform/admins`;
  - `POST /api/v1/platform/admins` (super user only; temporary password);
  - `POST /api/v1/platform/admins/{id}/deactivate` (super user only; `409 LAST_SUPER_USER`).
- **Stats and audit:**
  - `GET /api/v1/platform/stats?weeks=8`: counts, weekly trends and recent company activity;
  - `GET /api/v1/platform/audit` (filters, paginated).
  - Every console action is written to an append-only `audit_logs` table.
- **Mail:** a `mail_outbox` table and a console mailer behind an `IMailer` abstraction. No real email
  is sent yet (decision).

## Capabilities

### New Capabilities
- `developer-onboarding`: companies as the platform sees them. Covers list, detail, manual onboarding
  with an owner and a temporary password, suspend and reactivate.
- `developer-invites`: the invite lifecycle (issue, resend, revoke, derived expiry) and public
  preview and acceptance that provision a company.
- `platform-admins`: the platform operators (list, create, deactivate, last-super-user protection).
- `platform-insights`: dashboard stats and the audit trail.

### Modified Capabilities
- None.

## Impact

- **Frontend:**
  - `/platform` dashboard (stats, trends, activity);
  - `/platform/developers` (list, search and filter, onboard dialog with the one-time password,
    invite dialog, suspend and reactivate);
  - `/platform/developers/[id]`;
  - `/platform/invites` (list, resend, revoke);
  - `/platform/admins` (list, create, deactivate, `LAST_SUPER_USER` toast);
  - `/accept-invite/[token]` (preview and accept through the `/api/auth/accept-invite` route handler).
  No UI change.
- **Code:**
  - `migrations/0003_platform_console.sql` (`invites`, `audit_logs` with an append-only trigger,
    `mail_outbox`);
  - Organization, Invite and User aggregate additions;
  - the developer, invite, platformadmin and platforminsights modules;
  - five controllers;
  - `application/common/Authorization.ts`;
  - the mail and audit infrastructure.
- **Config:** `APP_BASE_URL` (default `http://localhost:3200`), used in invite links.
