-- Platform console: developer invites, the append-only audit trail and the mail outbox.

-- 'expired' is never stored: it is derived on read (pending AND expires_at < now()).
CREATE TABLE invites (
  id                 uuid PRIMARY KEY,
  email              citext NOT NULL,
  first_name         varchar(100) NOT NULL,
  last_name          varchar(100) NOT NULL,
  organization_name  varchar(120) NOT NULL,
  slug               citext NOT NULL,
  token_hash         char(64) NOT NULL,
  status             varchar(20) NOT NULL DEFAULT 'pending',
  expires_at         timestamptz NOT NULL,
  invited_by         uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  accepted_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_invites_token_hash UNIQUE (token_hash),
  CONSTRAINT ck_invites_status CHECK (status IN ('pending', 'accepted', 'revoked'))
);
CREATE INDEX idx_invites_status_created ON invites (status, created_at);
CREATE INDEX idx_invites_email ON invites (email);
CREATE INDEX idx_invites_slug ON invites (slug);

CREATE TABLE audit_logs (
  id               uuid PRIMARY KEY,
  actor_user_id    uuid REFERENCES users (id) ON DELETE RESTRICT,
  action           varchar(100) NOT NULL,
  entity_type      varchar(100) NOT NULL,
  entity_id        uuid,
  organization_id  uuid REFERENCES organizations (id) ON DELETE RESTRICT,
  old_values       jsonb,
  new_values       jsonb,
  ip               varchar(64),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_org_created ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);

-- Append-only: history cannot be rewritten, even by the application.
CREATE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- Every message the API would e-mail. No provider yet: the console mailer only records and logs.
CREATE TABLE mail_outbox (
  id          uuid PRIMARY KEY,
  to_email    citext NOT NULL,
  subject     varchar(200) NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);
CREATE INDEX idx_mail_outbox_created_at ON mail_outbox (created_at);
