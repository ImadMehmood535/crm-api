## Why

Browser QA on 2026-10-23 found two issues:
- An owner who accepts an invite is signed in straight away, but `lastLoginAt` stayed null, so the Users screen showed "Never".
- The role permission label still said "Delete roles", although roles are deactivated, not deleted.

## What Changes

- Accepting an invite records the sign-in (`users.last_login_at`), like a normal login does.
- The `roles.delete` permission is labelled "Deactivate roles" in the catalogue seed. The seed is idempotent, so existing databases update on the next run.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `developer-onboarding`: invite acceptance counts as the owner's first sign-in.

## Impact

- Files: `AcceptInviteCommandHandler` and its spec, plus `seeds/permission-catalogue.seed.ts`.
- No migration and no contract shape change.
