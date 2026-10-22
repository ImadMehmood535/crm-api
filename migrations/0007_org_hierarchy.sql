-- Organisation hierarchy: user levels, departments with heads, teams and (many-to-many) membership.

ALTER TABLE users ADD COLUMN level varchar(20);
ALTER TABLE users ADD CONSTRAINT ck_users_level
  CHECK (level IN ('owner', 'admin', 'department_head', 'member'));
UPDATE users SET level = 'member' WHERE organization_id IS NOT NULL;
UPDATE users u SET level = 'owner'
  WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id AND r.is_system_role AND r.organization_id IS NOT NULL);
-- Visibility walks who-created-whom.
CREATE INDEX idx_users_created_by ON users (created_by);

CREATE TABLE departments (
  id               uuid PRIMARY KEY,
  organization_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name             varchar(100) NOT NULL,
  name_key         varchar(100) NOT NULL,
  head_user_id     uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_by       uuid REFERENCES users (id) ON DELETE RESTRICT,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_departments_org_id UNIQUE (organization_id, id),
  CONSTRAINT ck_departments_name CHECK (length(name) BETWEEN 2 AND 100)
);
CREATE UNIQUE INDEX uq_departments_org_name_active ON departments (organization_id, name_key) WHERE is_active;
CREATE INDEX idx_departments_head ON departments (head_user_id);

CREATE TABLE teams (
  id               uuid PRIMARY KEY,
  organization_id  uuid NOT NULL,
  department_id    uuid NOT NULL,
  name             varchar(100) NOT NULL,
  name_key         varchar(100) NOT NULL,
  created_by       uuid REFERENCES users (id) ON DELETE RESTRICT,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- A team always belongs to a department of its own company.
  CONSTRAINT fk_teams_department FOREIGN KEY (organization_id, department_id)
    REFERENCES departments (organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_teams_name CHECK (length(name) BETWEEN 2 AND 100)
);
CREATE UNIQUE INDEX uq_teams_department_name_active ON teams (department_id, name_key) WHERE is_active;
CREATE INDEX idx_teams_department ON teams (department_id);

-- A user can be in many teams.
CREATE TABLE team_members (
  team_id   uuid NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  added_by  uuid REFERENCES users (id) ON DELETE RESTRICT,
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members (user_id);
