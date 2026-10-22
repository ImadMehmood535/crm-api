# developer-invites Specification

## Purpose
Lets platform operators invite a developer company by email, and lets the invitee preview and accept
the invite, which creates the company and its owner and signs the owner in.

## Requirements

### Requirement: Invite shape and derived expiry
An `Invite` SHALL be `{ id, email, firstName, lastName, organizationName, slug, status, expiresAt, createdAt }`,
where `status` is one of `pending`, `accepted`, `revoked` or `expired`. `expired` is derived when
reading: a pending invite whose `expiresAt` has passed. Invites expire 7 days after they are issued or
resent.

#### Scenario: Expired invite
- **WHEN** a pending invite's expiry time has passed
- **THEN** it is listed with `status: expired`

### Requirement: List invites
`GET /api/v1/platform/invites` SHALL return `Invite[]` with `meta`, newest first, optionally filtered
by `status`, with the derived status applied to the filter.

#### Scenario: Filter expired
- **WHEN** the operator lists with `status=expired`
- **THEN** only pending invites past their expiry are returned

### Requirement: Issue invite
`POST /api/v1/platform/invites` with `{ email, firstName, lastName, organizationName, slug }` SHALL
answer 201 with the `Invite` and send the link `{APP_BASE_URL}/accept-invite/{token}` through the
mailer. It validates fields as 422 `VALIDATION_FAILED`, slugs as 422 `SLUG_RESERVED` and 409
`SLUG_CONFLICT`, and an existing account as 409 `EMAIL_CONFLICT`. A second live invite for the same
email is 409 `INVITE_PENDING`. Only a hash of the token is stored.

#### Scenario: Issue
- **WHEN** an operator invites `new@dev.example.com` for "Harbor Homes" (`harbor-homes`)
- **THEN** the API answers 201 with `status: pending`, and the mail outbox holds a message with the accept link

#### Scenario: Duplicate live invite
- **WHEN** the email already has a live pending invite
- **THEN** the API answers 409 `INVITE_PENDING`

### Requirement: Resend and revoke
`POST /api/v1/platform/invites/{id}/resend` SHALL renew the token and the expiry for a `pending` or
`expired` invite and answer 200 with it. `POST /api/v1/platform/invites/{id}/revoke` SHALL mark a
`pending` invite `revoked`. Either action on an accepted or revoked invite is 409
`INVITE_NOT_PENDING`. An unknown id is 404 `NOT_FOUND`.

#### Scenario: Resend expired
- **WHEN** an operator resends an expired invite
- **THEN** the API answers 200 with `status: pending` and a new `expiresAt`, and the old link stops working

#### Scenario: Revoke accepted
- **WHEN** an operator revokes an accepted invite
- **THEN** the API answers 409 `INVITE_NOT_PENDING`

### Requirement: Public preview
`GET /api/v1/public/invites/{token}` SHALL be public and answer 200 with
`{ email, firstName, lastName, organizationName, slug, expiresAt }` for a live invite. Any unknown,
malformed, expired, accepted or revoked token is the same 404 `INVITE_INVALID`.

#### Scenario: Valid token
- **WHEN** the invitee opens a live invite link
- **THEN** the preview is returned

#### Scenario: Revoked token
- **WHEN** the invite was revoked
- **THEN** the API answers 404 `INVITE_INVALID`

### Requirement: Accept invite
`POST /api/v1/public/invites/{token}/accept` with `{ password, organizationName?, firstName?, lastName? }`
SHALL create the company (the invite's slug, the given or invited name), its `developer_super_user`
role and the owner with the invited email. It then marks the invite accepted and answers 200 with an
`AuthSession`. No password reset is required.

#### Scenario: Accept
- **WHEN** the invitee accepts with a 12+ character password
- **THEN** the API answers 200 with a session whose user is the tenant super user of the new company, and the invite shows `accepted`

#### Scenario: Accept twice
- **WHEN** the same token is accepted again
- **THEN** the API answers 404 `INVITE_INVALID`

### Requirement: Accept invite validation
Any body field other than `password`, `organizationName`, `firstName` and `lastName` SHALL be 422. A
password under 12 characters is 422 on `password`. A slug or email taken since the invite was issued
is 409 `SLUG_CONFLICT` or `EMAIL_CONFLICT`.

#### Scenario: Extra field
- **WHEN** the body also contains `slug`
- **THEN** the API answers 422 `VALIDATION_FAILED` naming `slug`

#### Scenario: Short password
- **WHEN** the password has 11 characters
- **THEN** the API answers 422 with a detail for `password`
