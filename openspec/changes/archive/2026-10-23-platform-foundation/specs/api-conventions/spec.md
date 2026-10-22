# Spec Delta

## Purpose

Defines the HTTP behaviour every endpoint of the CRM Developer API shares, so that the existing
frontend can unwrap responses, show errors and map field errors onto forms the same way everywhere.

## ADDED Requirements

### Requirement: Versioned base path
Every business endpoint SHALL be served under the `/api/v1` prefix. The only exception is the health
probe at `/health`. JSON is the only request and response format, except for endpoints that a later
spec explicitly defines as binary.

#### Scenario: Versioned route
- **WHEN** a client calls `GET /api/v1/<resource>`
- **THEN** the request reaches that resource's handler

#### Scenario: Unversioned business route
- **WHEN** a client calls `GET /<resource>` without the prefix
- **THEN** the API answers 404 in the error envelope

### Requirement: Success envelope
Every successful JSON response SHALL have the shape `{ "success": true, "data": <payload> }`. An
operation with no payload returns `"data": null`.

#### Scenario: Single resource
- **WHEN** an endpoint returns one resource
- **THEN** the body is `{ "success": true, "data": { ... } }`

#### Scenario: No payload
- **WHEN** an endpoint completes without a result (for example a logout)
- **THEN** the body is `{ "success": true, "data": null }`

### Requirement: Paginated lists
List endpoints SHALL accept `page` (default 1, minimum 1) and `pageSize` (default 20, minimum 1,
maximum 100). They SHALL answer `{ "success": true, "data": [ ... ], "meta": { "page", "pageSize", "total" } }`,
where `total` counts every matching row.

#### Scenario: Defaults
- **WHEN** a list endpoint is called without `page` or `pageSize`
- **THEN** it returns at most 20 items and `meta` is `{ "page": 1, "pageSize": 20, "total": <count> }`

#### Scenario: Page size above the maximum
- **WHEN** a list endpoint is called with `pageSize=101`
- **THEN** the API answers 422 `VALIDATION_FAILED` with a detail for the field `pageSize`

#### Scenario: Page beyond the end
- **WHEN** `page` points past the last page
- **THEN** `data` is an empty array and `meta.total` is still the full count

### Requirement: Error envelope
Every failed response SHALL have the shape
`{ "success": false, "error": { "code": <string>, "message": <string>, "details"?: [{ "field"?: <string>, "messages": [<string>] }] } }`.
`code` is a stable machine-readable value, and `message` is safe to show to a user.

#### Scenario: Not found
- **WHEN** a client requests a resource that does not exist
- **THEN** the API answers 404 with `error.code` `NOT_FOUND`

#### Scenario: Unknown route
- **WHEN** a client calls a path no endpoint serves
- **THEN** the API answers 404 with `error.code` `NOT_FOUND` in the error envelope

#### Scenario: Unexpected failure
- **WHEN** an unhandled error occurs
- **THEN** the API answers 500 with `error.code` `INTERNAL_ERROR` and a generic message, and no stack trace or internal detail is returned

### Requirement: Validation failures list every bad field
A request whose body, query or path parameters fail validation SHALL be answered with 422 and
`error.code` `VALIDATION_FAILED`. `details` SHALL contain one entry per invalid field, covering
every invalid field in one response. Nested fields use dot notation (`superUser.email`).

#### Scenario: Several bad fields
- **WHEN** a create request has an invalid email and a missing required name
- **THEN** the API answers 422 and `details` contains entries for both the email field and the name field

#### Scenario: Nested field
- **WHEN** the nested field `superUser.email` is invalid
- **THEN** the detail's `field` is `superUser.email`

#### Scenario: Unknown property
- **WHEN** a request body contains a property the endpoint does not accept
- **THEN** the API answers 422 `VALIDATION_FAILED` with a detail naming that property

### Requirement: Malformed requests
A request body that is not valid JSON SHALL be answered with 400 and `error.code` `BAD_REQUEST`.

#### Scenario: Broken JSON
- **WHEN** a client sends `{"name": ` as a JSON body
- **THEN** the API answers 400 with `error.code` `BAD_REQUEST`

### Requirement: Identifiers are UUIDs
Resource identifiers in paths and bodies SHALL be UUID strings. A path id that is not a UUID SHALL
be answered with 404 `NOT_FOUND`, the same as an id that does not exist, so that callers cannot
probe for valid ids.

#### Scenario: Malformed id
- **WHEN** a client requests `/api/v1/<resource>/abc`
- **THEN** the API answers 404 with `error.code` `NOT_FOUND`

### Requirement: Timestamps
Timestamps in responses SHALL be ISO-8601 UTC strings. Calendar dates SHALL be `YYYY-MM-DD` strings.

#### Scenario: Created timestamp
- **WHEN** a resource with a creation time is returned
- **THEN** `createdAt` looks like `2026-10-23T01:02:03.456Z`

### Requirement: Health probe
`GET /health` SHALL be public and unversioned, and SHALL NOT use the envelope. It answers 200
`{ "status": "ok", "db": "up" }` when the database is reachable. Otherwise it answers 503
`{ "status": "error", "db": "down" }`.

#### Scenario: Healthy
- **WHEN** the database is reachable and a client calls `GET /health`
- **THEN** the API answers 200 `{ "status": "ok", "db": "up" }`

#### Scenario: Database down
- **WHEN** the database cannot be reached
- **THEN** the API answers 503 `{ "status": "error", "db": "down" }`
