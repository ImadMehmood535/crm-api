# auth-sessions Specification

## Purpose
Authenticates platform operators and tenant users with a short-lived access token and a rotating
refresh token. Every request is re-checked against the server-side session, user and company state.

## Requirements

### Requirement: Login
`POST /api/v1/auth/login` with `{ email, password }` SHALL return 200 with an `AuthSession`:
`{ accessToken, refreshToken, expiresIn, user: AuthUser }`, where `expiresIn` is the access token
lifetime in seconds. The email is matched case-insensitively after trimming. A missing or non-string
field is a 422 `VALIDATION_FAILED`.

#### Scenario: Correct credentials
- **WHEN** an active user of an active company logs in with the right email and password
- **THEN** the API answers 200 with an access token, a refresh token, `expiresIn` 900 and the user's `AuthUser`

#### Scenario: Email in another case
- **WHEN** the user logs in with `  Owner@Example.COM ` for the account `owner@example.com`
- **THEN** the login succeeds

#### Scenario: Missing field
- **WHEN** the body has no `password`
- **THEN** the API answers 422 `VALIDATION_FAILED` with a detail for `password`

### Requirement: Login failures do not reveal accounts
An unknown email and a wrong password SHALL both be answered with 401 `INVALID_CREDENTIALS` and the
message "Invalid email or password". The account's status SHALL be revealed only after a correct
password: 403 `ORGANIZATION_SUSPENDED` when the user's company is suspended, otherwise 403
`ACCOUNT_INACTIVE` when the user is not active.

#### Scenario: Unknown email
- **WHEN** someone logs in with an email that has no account
- **THEN** the API answers 401 `INVALID_CREDENTIALS`

#### Scenario: Wrong password
- **WHEN** someone logs in with a known email and a wrong password
- **THEN** the API answers 401 `INVALID_CREDENTIALS`

#### Scenario: Suspended company
- **WHEN** a user of a suspended company logs in with the correct password
- **THEN** the API answers 403 `ORGANIZATION_SUSPENDED`

#### Scenario: Inactive user
- **WHEN** an inactive user of an active company logs in with the correct password
- **THEN** the API answers 403 `ACCOUNT_INACTIVE`

#### Scenario: Wrong password for a suspended company
- **WHEN** a user of a suspended company logs in with a wrong password
- **THEN** the API answers 401 `INVALID_CREDENTIALS`

### Requirement: AuthUser shape
`AuthUser` SHALL be `{ id, email, firstName, lastName, plane, roles, isSuperUser, organization, mustResetPassword, permissions, level }`.
`roles` lists the codes of the user's active roles, `permissions` lists the user's effective
`module.action` codes, and `level` is the user's hierarchy level (`owner`, `admin`,
`department_head` or `member`), or `null` on the platform plane.

#### Scenario: Fields present
- **WHEN** any user logs in
- **THEN** `user` has exactly the eleven fields above, and no password, hash or token field

### Requirement: Plane and organization
`plane` SHALL be `platform` for users without a company and `tenant` otherwise. `organization` is
`{ id, name, slug, status }`, or `null` on the platform plane. `isSuperUser` is true for
`platform_super_user` and `developer_super_user`. Platform users have no permissions.

#### Scenario: Platform super user
- **WHEN** the seeded platform super user logs in
- **THEN** `user.plane` is `platform`, `user.roles` contains `platform_super_user`, `user.isSuperUser` is true, `user.organization` is null and `user.permissions` is empty

#### Scenario: Tenant user
- **WHEN** a tenant user logs in
- **THEN** `user.plane` is `tenant` and `user.organization` holds the company's id, name, slug and status

### Requirement: Refresh with rotation
`POST /api/v1/auth/refresh` with `{ refreshToken }` SHALL return 200 with a new `AuthSession`. The
presented refresh token becomes unusable at that moment. A refresh token expires 30 days after it was
issued.

#### Scenario: Valid refresh token
- **WHEN** a client refreshes with its current refresh token
- **THEN** the API answers 200 with a new access token and a different refresh token

#### Scenario: Unknown or expired token
- **WHEN** a client refreshes with a token that does not exist or has expired
- **THEN** the API answers 401 `UNAUTHENTICATED`

### Requirement: Refresh token reuse revokes the login chain
Presenting a refresh token that has already been rotated SHALL be answered with 401 `UNAUTHENTICATED`.
It also revokes every session of that login chain, so the most recent refresh token stops working too.

#### Scenario: Replay of a rotated token
- **WHEN** a client refreshes with token A, receives token B, and then refreshes with token A again
- **THEN** the second request with A answers 401 `UNAUTHENTICATED`, and a later refresh with B also answers 401 `UNAUTHENTICATED`

### Requirement: Refresh re-checks account state
A refresh SHALL be refused with 403 `ORGANIZATION_SUSPENDED` when the user's company is suspended,
and with 403 `ACCOUNT_INACTIVE` when the user is no longer active. The session is kept, so a later
reactivation restores access.

#### Scenario: Company suspended after login
- **WHEN** a tenant user's company is suspended and the user then refreshes
- **THEN** the API answers 403 `ORGANIZATION_SUSPENDED`

### Requirement: Authenticated requests
Every endpoint except those explicitly public SHALL require the header
`Authorization: Bearer <accessToken>`. A missing, malformed, expired or forged token, or a token whose
session has been revoked, SHALL be answered with 401 `UNAUTHENTICATED`.

#### Scenario: No token
- **WHEN** a client calls `GET /api/v1/auth/me` without an Authorization header
- **THEN** the API answers 401 `UNAUTHENTICATED`

#### Scenario: Revoked session
- **WHEN** a client calls an endpoint with an unexpired access token whose session was logged out
- **THEN** the API answers 401 `UNAUTHENTICATED`

#### Scenario: Tampered token
- **WHEN** a client sends an access token whose signature does not match
- **THEN** the API answers 401 `UNAUTHENTICATED`

### Requirement: Suspension takes effect on the next request
On every authenticated request, a user whose company is suspended SHALL be answered with 403
`ORGANIZATION_SUSPENDED`, and a user who is no longer active with 403 `ACCOUNT_INACTIVE`, even when
their access token has not expired.

#### Scenario: Suspended while signed in
- **WHEN** a tenant user's company is suspended and the user then calls `GET /api/v1/auth/me` with a still-valid access token
- **THEN** the API answers 403 `ORGANIZATION_SUSPENDED`

### Requirement: Forced password reset gate
A user whose credential is marked "must reset" SHALL be answered with 403 `PASSWORD_RESET_REQUIRED` on
every authenticated endpoint, except `GET /auth/me`, `POST /auth/logout` and
`POST /auth/reset-password`. `AuthUser.mustResetPassword` is true for that user.

#### Scenario: Temporary password
- **WHEN** a user with a temporary password logs in and calls an endpoint other than me, logout or reset-password
- **THEN** the API answers 403 `PASSWORD_RESET_REQUIRED`

#### Scenario: Me is allowed
- **WHEN** that user calls `GET /api/v1/auth/me`
- **THEN** the API answers 200 with `mustResetPassword: true`

### Requirement: Reset password
`POST /api/v1/auth/reset-password` with `{ currentPassword, newPassword }` SHALL:
- set the new password;
- clear the must-reset flag;
- revoke every session of the user;
- return 200 with a new `AuthSession`.

A wrong `currentPassword` is 401 `INVALID_CREDENTIALS`. A `newPassword` shorter than 12 characters, or
equal to the current one, is 422 `VALIDATION_FAILED` with a detail for `newPassword`.

#### Scenario: Successful reset
- **WHEN** a user resets with the correct current password and a valid new password
- **THEN** the API answers 200 with a new session whose `user.mustResetPassword` is false, and the old refresh token no longer works

#### Scenario: Wrong current password
- **WHEN** the current password is wrong
- **THEN** the API answers 401 `INVALID_CREDENTIALS`

#### Scenario: Short new password
- **WHEN** the new password has 11 characters
- **THEN** the API answers 422 `VALIDATION_FAILED` with a detail for `newPassword`

#### Scenario: Same password
- **WHEN** the new password equals the current one
- **THEN** the API answers 422 `VALIDATION_FAILED` with a detail for `newPassword`

### Requirement: Logout
`POST /api/v1/auth/logout` SHALL revoke the caller's login chain and answer 200 with `data: null`.
Sessions on other devices stay valid.

#### Scenario: Logout
- **WHEN** a signed-in user logs out and then refreshes with their refresh token
- **THEN** logout answers 200 `{ success: true, data: null }` and the refresh answers 401 `UNAUTHENTICATED`

### Requirement: Current user
`GET /api/v1/auth/me` SHALL return the caller's `AuthUser`.

#### Scenario: Me
- **WHEN** a signed-in user calls `GET /api/v1/auth/me`
- **THEN** the API answers 200 with the same `AuthUser` the login returned

### Requirement: Secrets are never exposed
Passwords SHALL be stored only as salted, slow hashes, and refresh tokens only as SHA-256 digests. No
response, log line or error SHALL contain a password, a password hash, a refresh token hash or the JWT
secret.

#### Scenario: Stored refresh token
- **WHEN** a session is created
- **THEN** the database row holds only the digest of the refresh token, and never the token itself
