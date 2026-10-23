-- Per-user permission overrides on top of roles: effective = (role codes ∪ grants) − revokes.
CREATE TABLE user_permission_overrides (
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  permission_id  uuid NOT NULL REFERENCES permissions (id) ON DELETE RESTRICT,
  effect         varchar(10) NOT NULL,
  set_by         uuid REFERENCES users (id) ON DELETE RESTRICT,
  set_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT ck_user_permission_overrides_effect CHECK (effect IN ('grant', 'revoke'))
);
CREATE INDEX idx_user_permission_overrides_permission_id ON user_permission_overrides (permission_id);
