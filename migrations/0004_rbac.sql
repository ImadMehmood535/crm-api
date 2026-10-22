-- Tenant RBAC: the permission catalogue (seeded) and the permissions each role grants.

CREATE TABLE modules (
  id                uuid PRIMARY KEY,
  code              varchar(100) NOT NULL,
  name              varchar(100) NOT NULL,
  parent_module_id  uuid REFERENCES modules (id) ON DELETE RESTRICT,
  description       text,
  sort_order        integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_modules_code UNIQUE (code)
);

CREATE TABLE permissions (
  id           uuid PRIMARY KEY,
  module_id    uuid NOT NULL REFERENCES modules (id) ON DELETE RESTRICT,
  action       varchar(50) NOT NULL,
  code         varchar(150) NOT NULL,
  name         varchar(100) NOT NULL,
  description  text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_permissions_code UNIQUE (code),
  CONSTRAINT uq_permissions_module_action UNIQUE (module_id, action)
);

-- What a role grants. The company owner's system role has no rows: it implicitly holds everything.
CREATE TABLE role_permissions (
  role_id        uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  permission_id  uuid NOT NULL REFERENCES permissions (id) ON DELETE RESTRICT,
  granted_by     uuid REFERENCES users (id) ON DELETE RESTRICT,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions (permission_id);

-- Roles are deactivated, never deleted: only active roles need unique codes within a company.
DROP INDEX uq_roles_org_code;
CREATE UNIQUE INDEX uq_roles_org_code_active ON roles (organization_id, code)
  WHERE organization_id IS NOT NULL AND is_active;
