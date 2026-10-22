# Proposal: Company branding

## Why

The tenant workspace is white-labelled at runtime: the frontend's `ThemeProvider` reads
`GET /me/branding` and the Appearance page (`/app/settings/appearance`) saves colours and uploads the
logo, favicon and background. Without these endpoints every company sees the Invespy defaults, and
the Appearance page fails.

## What Changes

- `GET /api/v1/me/branding` (any tenant user): the company's `Branding`, or 404 `NOT_FOUND` while
  nothing is configured (the frontend falls back to the defaults).
- `PUT /api/v1/me/branding` (`branding.edit`): a partial colour update. Each colour is `#rrggbb` or
  `null` (back to the default), and a bad value is 422 on that field.
- `POST /api/v1/me/branding/assets/{kind}` (`branding.edit`, kind `logo`, `favicon` or
  `background`):
  - the raw image bytes;
  - PNG, JPEG or WebP only, recognised by magic bytes (anything else, SVG included, is 415
    `UNSUPPORTED_MEDIA_TYPE`);
  - per-kind limits (logo 512 KB, favicon 128 KB, background 2 MB), else 413 `PAYLOAD_TOO_LARGE`;
  - replacing an image gives it a new URL.
- `DELETE /api/v1/me/branding/assets/{kind}` (`branding.edit`) removes it.
- `GET /api/v1/branding-assets/{id}` (public): the image bytes, not enveloped, with `nosniff`,
  `inline` and an immutable cache header.
- Images are stored in PostgreSQL (no external storage, by decision). Changes are audited.

## Capabilities

### New Capabilities
- `company-branding`: covers a company's theme colours and images, how they are read, validated,
  stored and served.

### Modified Capabilities
- None.

## Impact

- **Frontend:** `ThemeProvider` / `useBranding` (every tenant page), `/app/settings/appearance`
  (colour save, discard, reset, uploads, read-only mode for `branding.view`), and the favicon. No UI
  change.
- **Code:**
  - `migrations/0005_branding.sql` (`organization_branding`, `branding_assets`);
  - the `Branding` aggregate and image rules;
  - the `branding` module;
  - `BrandingController` and `BrandingAssetsController`;
  - a raw-body parser for the upload route (`app.setup.ts`).
