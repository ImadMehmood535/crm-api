# Design: Per-user permission overrides

## Decisions

### D1. Schema (`migrations/0009_user_permission_overrides.sql`)
`user_permission_overrides`:
- columns: `user_id` → users, `permission_id` → permissions, `effect varchar(10)` with `CHECK (effect IN ('grant','revoke'))`, `set_by` → users (nullable), `set_at timestamptz`;
- primary key `(user_id, permission_id)`, so a code is either granted or revoked, never both;
- an index on `permission_id`.

### D2. SQL
- `rolePermissionsSql(userExpr)` is the old `effectivePermissionsSql` body: owner/admin get all codes, heads get the head set, others get the union of role grants.
- `effectivePermissionsSql(userExpr)` = `(rolePermissionsSql UNION grants) EXCEPT revokes`.

Every existing caller (auth, users, guards) gets overrides with no change on their side.

### D3. API
- `GET /users/{id}/permissions` uses the visibility rules (404 if the user is not visible).
- `PUT` takes the desired effective set:
  - the server computes `grants = desired − role` and `revokes = role − desired`;
  - it replaces the user's overrides in one transaction and audits `user.permissions_updated`.
- Checks run in this order:
  1. visible (else 404);
  2. `assertCanManage` (the owner, a stronger target);
  3. not self;
  4. codes exist (422);
  5. `assertHoldsAll(actor, desired)` (else 403 `PERMISSION_ESCALATION`).
- A desired set equal to the role codes leaves no rows.

### D4. Lifetime
Overrides are kept when roles or levels change, because they describe the person and not the role. The UI shows them and offers "Reset to role defaults", which sends the role codes.
