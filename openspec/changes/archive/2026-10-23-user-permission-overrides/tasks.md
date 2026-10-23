## 1. Backend

- [x] 1.1 Write migration 0009 (D1), plus `rolePermissionsSql`/`effectivePermissionsSql` (D2) and repository `replacePermissionOverrides`, with integration specs.
- [x] 1.2 Add the `getuserpermissions` and `setuserpermissions` slices with handler specs for every error.
- [x] 1.3 Add the two `UsersController` routes, the `user.permissions_updated` audit action, and the e2e scenarios.
- [x] 1.4 Run the pre-flight and `openspec validate --strict`.

## Follow-up
- Frontend (local only): a user detail page with the matrix and override markers, Save and Reset.
