-- Inventory: a company's projects and the sellable units inside them.

CREATE TABLE projects (
  id                   uuid PRIMARY KEY,
  organization_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name                 varchar(120) NOT NULL,
  name_key             varchar(120) NOT NULL,
  description          text,
  city                 varchar(100),
  address              varchar(300),
  currency             char(3) NOT NULL DEFAULT 'USD',
  status               varchar(20) NOT NULL DEFAULT 'planning',
  expected_completion  date,
  created_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_projects_org_name UNIQUE (organization_id, name_key),
  CONSTRAINT uq_projects_org_id UNIQUE (organization_id, id),
  CONSTRAINT ck_projects_name CHECK (length(name) BETWEEN 2 AND 120),
  CONSTRAINT ck_projects_description CHECK (length(description) <= 2000),
  CONSTRAINT ck_projects_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT ck_projects_status CHECK (status IN ('planning', 'active', 'completed', 'archived'))
);
CREATE INDEX idx_projects_org_status ON projects (organization_id, status);
CREATE INDEX idx_projects_org_created ON projects (organization_id, created_at DESC);

CREATE TABLE units (
  id               uuid PRIMARY KEY,
  organization_id  uuid NOT NULL,
  project_id       uuid NOT NULL,
  number           varchar(40) NOT NULL,
  number_key       varchar(40) NOT NULL,
  number_sort      varchar(200) NOT NULL,
  type             varchar(20) NOT NULL,
  status           varchar(20) NOT NULL DEFAULT 'available',
  bedrooms         smallint,
  bathrooms        smallint,
  area_sqm         numeric(10, 2),
  floor            smallint,
  price            numeric(14, 2),
  notes            text,
  created_by       uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- A unit always belongs to a project of its own company.
  CONSTRAINT fk_units_project FOREIGN KEY (organization_id, project_id)
    REFERENCES projects (organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_units_project_number UNIQUE (project_id, number_key),
  CONSTRAINT ck_units_type CHECK (type IN ('apartment', 'villa', 'townhouse', 'plot', 'shop', 'office')),
  CONSTRAINT ck_units_status CHECK (status IN ('available', 'reserved', 'sold', 'blocked')),
  CONSTRAINT ck_units_bedrooms CHECK (bedrooms BETWEEN 0 AND 50),
  CONSTRAINT ck_units_bathrooms CHECK (bathrooms BETWEEN 0 AND 50),
  CONSTRAINT ck_units_floor CHECK (floor BETWEEN -5 AND 200),
  CONSTRAINT ck_units_area CHECK (area_sqm > 0),
  CONSTRAINT ck_units_price CHECK (price >= 0),
  CONSTRAINT ck_units_notes CHECK (length(notes) <= 2000)
);
CREATE INDEX idx_units_project_sort ON units (project_id, number_sort);
CREATE INDEX idx_units_project_status ON units (project_id, status);
CREATE INDEX idx_units_org_status ON units (organization_id, status);
