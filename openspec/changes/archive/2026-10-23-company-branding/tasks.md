# Tasks

## 1. Schema and domain

- [x] 1.1 Write `migrations/0005_branding.sql` per D1. Verify with `npm run db:migrate`.
- [x] 1.2 Add the `Branding` aggregate, `BrandingImage` rules (magic bytes, limits), the 413/415 `AppError`s and the models, with unit specs (valid and invalid hex, null clears, each format, SVG, empty, max and max+1 per kind). Verify with `npm test`.

## 2. Infrastructure

- [x] 2.1 Add `BrandingRepository` and `BrandingQueries` plus `BrandingPersistenceModule`, with integration specs (upsert colours, replace gives a new id, remove, not-configured null, URLs, tenant isolation). Verify with `npm run test:int`.

## 3. Application and API

- [x] 3.1 Add the branding slices (getbranding, updatebranding, uploadbrandingasset, removebrandingasset, getbrandingasset) with handler specs for each error code and permission. Verify with `npm test`.
- [x] 3.2 Add the raw-body parser in `configureApp`, the `@RawBody()` decorator, `BrandingController` and `BrandingAssetsController` (headers), and register them. Verify that `npm run build` passes.

## 4. End-to-end

- [x] 4.1 Add `test/company-branding.e2e-spec.ts` covering every scenario in the spec (including the image headers and a 2.5 MB body giving 413). Verify with `npm run test:e2e`.
- [x] 4.2 Smoke-test through the real frontend: save colours, upload a logo, fetch it through `/api/v1/branding-assets`, and read branding as another user. Record the results in the PR.

## 5. Pre-flight

- [x] 5.1 Run the §18.4 pre-flight and `openspec validate company-branding --strict`, then fill in the scorecard. Verify that every command exits 0.

## Workflow follow-up

- Archive the change on the branch, then open the PR to `development` and merge it.
