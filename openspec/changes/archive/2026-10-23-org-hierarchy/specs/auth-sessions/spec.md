# Spec Delta

## MODIFIED Requirements

### Requirement: AuthUser shape
`AuthUser` SHALL be `{ id, email, firstName, lastName, plane, roles, isSuperUser, organization, mustResetPassword, permissions, level }`.
`roles` lists the codes of the user's active roles, `permissions` lists the user's effective
`module.action` codes, and `level` is the user's hierarchy level (`owner`, `admin`,
`department_head` or `member`), or `null` on the platform plane.

#### Scenario: Fields present
- **WHEN** any user logs in
- **THEN** `user` has exactly the eleven fields above, and no password, hash or token field
