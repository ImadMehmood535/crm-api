# company-branding Specification

## Purpose
Lets each company white-label its workspace with theme colours, a logo, a favicon and a background
image. These are stored in the platform's own database and served from the same origin.

## Requirements

### Requirement: Read branding
`GET /api/v1/me/branding` SHALL return the caller's company branding as
`{ primaryColor, secondaryColor, accentColor, logoUrl, faviconUrl, backgroundImageUrl }` to any
tenant user. Colours are `#rrggbb` or `null`. URLs are same-origin `/api/v1/branding-assets/{id}`
or `null`. While nothing is configured the API answers 404 `NOT_FOUND`. Platform users get 403
`PERMISSION_DENIED`.

#### Scenario: Not configured
- **WHEN** a company never set any branding
- **THEN** `GET /api/v1/me/branding` answers 404 `NOT_FOUND`

#### Scenario: Any tenant user may read
- **WHEN** a user without any branding permission calls it after the owner saved colours
- **THEN** the API answers 200 with those colours

### Requirement: Update colours
`PUT /api/v1/me/branding` with any of `primaryColor`, `secondaryColor` and `accentColor` (needs
`branding.edit`) SHALL apply only the given keys. A `#rrggbb` value is stored in lowercase, and
`null` clears the key back to the default. Any other value is 422 on that field, and every bad field
is reported together. The response is the full `Branding`.

#### Scenario: Save colours
- **WHEN** the owner puts `{ "primaryColor": "#0D9488", "accentColor": "#f97316" }`
- **THEN** the response has `primaryColor: "#0d9488"`, `accentColor: "#f97316"` and the other values unchanged

#### Scenario: Bad colours
- **WHEN** `primaryColor` is `teal` and `secondaryColor` is `#12`
- **THEN** the API answers 422 with details for `primaryColor` and `secondaryColor`

#### Scenario: Read-only user
- **WHEN** a user holding only `branding.view` puts colours
- **THEN** the API answers 403 `PERMISSION_DENIED`

### Requirement: Upload an image
`POST /api/v1/me/branding/assets/{kind}`, with kind `logo`, `favicon` or `background` and the raw
image bytes as the body (needs `branding.edit`), SHALL store the image and answer with the full
`Branding`. The new URL differs from any previous one.

#### Scenario: Upload a logo
- **WHEN** the owner uploads a 2 KB PNG as `logo`
- **THEN** `logoUrl` points to `/api/v1/branding-assets/{id}`, and fetching it returns the same bytes as `image/png`

#### Scenario: Replace
- **WHEN** the owner uploads another logo
- **THEN** `logoUrl` changes and the old URL answers 404

### Requirement: Image upload rules
An unknown kind SHALL be 422 on `kind`, and an empty body 422 on `file`. An image over its kind's
limit (logo 512 KB, favicon 128 KB, background 2 MB) is 413 `PAYLOAD_TOO_LARGE`. Content that is not
PNG, JPEG or WebP by its magic bytes is 415 `UNSUPPORTED_MEDIA_TYPE`, whatever the declared type.

#### Scenario: Unknown kind
- **WHEN** the kind is `banner`
- **THEN** the API answers 422 with a detail for `kind`

#### Scenario: SVG refused
- **WHEN** the body is an SVG document
- **THEN** the API answers 415 `UNSUPPORTED_MEDIA_TYPE`

#### Scenario: Too large
- **WHEN** a 200 KB PNG is uploaded as `favicon`
- **THEN** the API answers 413 `PAYLOAD_TOO_LARGE`

### Requirement: Remove an image
`DELETE /api/v1/me/branding/assets/{kind}` (needs `branding.edit`) SHALL remove that image and
answer with the full `Branding`, where that URL is now `null`.

#### Scenario: Remove the favicon
- **WHEN** the owner removes the favicon
- **THEN** `faviconUrl` is null and the old URL answers 404

### Requirement: Serve images
`GET /api/v1/branding-assets/{id}` SHALL be public and answer the stored bytes with their
`Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` and
`Cache-Control: public, max-age=31536000, immutable`, without the JSON envelope. An unknown id is 404.

#### Scenario: Fetch without signing in
- **WHEN** an anonymous client fetches a logo URL
- **THEN** the API answers 200 with the image
