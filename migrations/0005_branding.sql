-- Company branding: theme colours and images (stored in PostgreSQL; no external storage).

CREATE TABLE organization_branding (
  organization_id  uuid PRIMARY KEY REFERENCES organizations (id) ON DELETE RESTRICT,
  primary_color    char(7),
  secondary_color  char(7),
  accent_color     char(7),
  updated_by       uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_branding_primary CHECK (primary_color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_branding_secondary CHECK (secondary_color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_branding_accent CHECK (accent_color ~ '^#[0-9a-f]{6}$')
);

-- One image per kind per company. Replacing deletes the row, so each id (URL) is immutable.
CREATE TABLE branding_assets (
  id               uuid PRIMARY KEY,
  organization_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  kind             varchar(20) NOT NULL,
  content_type     varchar(50) NOT NULL,
  size_bytes       integer NOT NULL,
  data             bytea NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_branding_assets_org_kind UNIQUE (organization_id, kind),
  CONSTRAINT ck_branding_assets_kind CHECK (kind IN ('logo', 'favicon', 'background')),
  CONSTRAINT ck_branding_assets_type CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp'))
);
