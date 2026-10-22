-- Identity and sessions: companies, people on both planes, credentials, roles, refresh-token sessions.

CREATE TABLE organizations (
  id          uuid PRIMARY KEY,
  name        varchar(120) NOT NULL,
  slug        citext NOT NULL,
  status      varchar(20) NOT NULL DEFAULT 'active',
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organizations_slug UNIQUE (slug),
  CONSTRAINT ck_organizations_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 40),
  CONSTRAINT ck_organizations_status CHECK (status IN ('active', 'suspended'))
);
CREATE INDEX idx_organizations_status ON organizations (status);
CREATE INDEX idx_organizations_created_at ON organizations (created_at);

-- organization_id NULL = platform user (Invespy operator). Emails are global: login has no company field.
CREATE TABLE users (
  id               uuid PRIMARY KEY,
  organization_id  uuid REFERENCES organizations (id) ON DELETE RESTRICT,
  email            citext NOT NULL,
  first_name       varchar(100) NOT NULL,
  last_name        varchar(100) NOT NULL,
  status           varchar(20) NOT NULL DEFAULT 'active',
  is_system        boolean NOT NULL DEFAULT false,
  last_login_at    timestamptz,
  deactivated_at   timestamptz,
  created_by       uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT ck_users_status CHECK (status IN ('active', 'inactive', 'suspended'))
);
CREATE INDEX idx_users_organization_id ON users (organization_id);
CREATE INDEX idx_users_status ON users (status);

ALTER TABLE organizations
  ADD CONSTRAINT fk_organizations_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT;

-- The only place a password hash lives, so no user query can return it by accident.
CREATE TABLE user_credentials (
  user_id              uuid PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  password_hash        text NOT NULL,
  must_reset_password  boolean NOT NULL DEFAULT false,
  password_updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- organization_id NULL = platform role; otherwise a role owned by one company.
CREATE TABLE roles (
  id               uuid PRIMARY KEY,
  organization_id  uuid REFERENCES organizations (id) ON DELETE RESTRICT,
  code             varchar(50) NOT NULL,
  name             varchar(100) NOT NULL,
  description      text,
  is_system_role   boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_roles_org_code ON roles (organization_id, code) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX uq_roles_platform_code ON roles (code) WHERE organization_id IS NULL;
CREATE INDEX idx_roles_organization_id ON roles (organization_id);

CREATE TABLE user_roles (
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  role_id      uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  assigned_by  uuid REFERENCES users (id) ON DELETE RESTRICT,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

-- One row per refresh token. Only its SHA-256 is stored. A login chain shares family_id.
CREATE TABLE user_sessions (
  id                  uuid PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  family_id           uuid NOT NULL,
  refresh_token_hash  char(64) NOT NULL,
  expires_at          timestamptz NOT NULL,
  last_used_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  revoked_reason      varchar(30),
  replaced_by         uuid REFERENCES user_sessions (id) ON DELETE RESTRICT,
  ip_address          varchar(64),
  user_agent          varchar(255),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_sessions_token UNIQUE (refresh_token_hash)
);
CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_family_id ON user_sessions (family_id);
