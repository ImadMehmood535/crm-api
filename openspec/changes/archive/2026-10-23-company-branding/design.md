# Design: Company branding

## Context

See proposal.md. The frontend sends uploads as the raw bytes with the file's `Content-Type`
(`crm-developer-ui/src/features/tenancy/api/branding-api.ts`). Expected behaviour is in
`src/mocks/branding-handlers.ts`. There is no external storage (decision), so images live in
PostgreSQL.

## Goals / Non-Goals

**Goals:** the Appearance page and the runtime theme work against the API.

**Non-Goals:** image resizing or cropping, per-theme logo variants, and a CDN.

## Decisions

### D1. Schema (`migrations/0005_branding.sql`)
| Table | Columns | Constraints |
| ----- | ------- | ----------- |
| `organization_branding` | `organization_id uuid` PK → organizations, `primary_color char(7)?`, `secondary_color char(7)?`, `accent_color char(7)?`, `updated_by uuid?` → users, `created_at`, `updated_at` | `CHECK (… ~ '^#[0-9a-f]{6}$')` on each colour |
| `branding_assets` | `id uuid`, `organization_id` → organizations, `kind varchar(20)`, `content_type varchar(50)`, `size_bytes int`, `data bytea`, `created_at` | `UNIQUE(organization_id, kind)`; `CHECK kind IN ('logo','favicon','background')`; `CHECK content_type IN ('image/png','image/jpeg','image/webp')` |

Replacing an image deletes the old row and inserts a new one. That gives a new id, so every URL is
immutable and can be cached forever.

### D2. Domain
- `domain/aggregates/BrandingAggregate/Branding.ts`: the colours and `setColor(key, value | null)`,
  which validates `#rrggbb` (422 on the key) and lowercases it.
- `BrandingImage.ts`: `ASSET_KINDS`, `ASSET_SIZE_LIMITS`, `detectImageType(bytes)` (magic bytes:
  PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF…WEBP`), and
  `validateImage(kind, bytes) → contentType`, which throws 422 `file`, 413 or 415.
  These are pure functions with unit tests.

### D3. Raw upload body
`configureApp` mounts `express.raw({ type: () => true, limit: '2mb' })` on
`/api/v1/me/branding/assets`, so the body is a `Buffer` whatever the declared type (the bytes decide,
D2). Bodies over 2 MB are rejected by the parser with 413, which the filter maps to
`PAYLOAD_TOO_LARGE`. A `@RawBody()` parameter decorator hands the `Buffer` to the controller. It is a
custom decorator, so the global `ValidationPipe` does not touch it.

### D4. Write and read sides
- **`IBrandingRepository`:**
  - `findColors(organizationId)`;
  - `saveColors(organizationId, branding, updatedBy, tx)` (upsert);
  - `replaceAsset(organizationId, kind, contentType, data, tx) → id` (delete, then insert);
  - `removeAsset(organizationId, kind, tx)`.
- **`IBrandingQueries`:**
  - `findBranding(organizationId) → BrandingReadModel | null`. It is null when no colour and no
    asset exist, which gives the 404. URLs are built as `/api/v1/branding-assets/${id}`.
  - `findAsset(id) → { contentType, data } | null`.

### D5. Slices and routes
`application/modules/branding/features`: `getbranding`, `updatebranding`, `uploadbrandingasset`,
`removebrandingasset`, `getbrandingasset` (public).
- `BrandingController` → `me/branding`.
- `BrandingAssetsController` → `branding-assets/:id`. It is `@Public()` and `@RawResponse()`, and
  writes the headers itself.
Audit actions: `branding.updated`, `branding.asset_uploaded`, `branding.asset_removed`.

### D6. Errors
- An unknown kind in the path is 422 on `kind`. It is checked in the handler, because the frontend
  expects a field detail.
- An empty body is 422 on `file`.
- The size limit is 413 `PAYLOAD_TOO_LARGE`, with the message "The image is too large (limit 512 KB)."
- A wrong format is 415 `UNSUPPORTED_MEDIA_TYPE`, with the message "Upload a PNG, JPEG or WebP image
  (SVG and other formats are not accepted)."
- A new `PayloadTooLargeError` (413) and `UnsupportedMediaTypeError` (415) join the `AppError` family.

## Risks / Trade-offs

- [Images in the database grow the DB] → Sizes are capped at 2.6 MB per company in the worst case,
  which is fine at this scale. `IBrandingRepository` is the seam for object storage later.
