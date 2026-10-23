-- Built-in level roles: "Admin" and "Department Head", one active each per company. Their codes are
-- derived in queries (never stored as grants); the `level-roles` seed creates and assigns them.
ALTER TABLE roles ADD COLUMN level_role varchar(20);
ALTER TABLE roles ADD CONSTRAINT ck_roles_level_role CHECK (level_role IN ('admin', 'department_head'));
CREATE UNIQUE INDEX uq_roles_org_level_role_active ON roles (organization_id, level_role)
  WHERE level_role IS NOT NULL AND is_active;
