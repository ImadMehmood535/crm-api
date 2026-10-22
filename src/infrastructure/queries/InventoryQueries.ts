import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import {
  IInventoryQueries,
  ProjectListFilter,
  ProjectReadModel,
  UnitListFilter,
  UnitReadModel,
} from './abstraction/IInventoryQueries';
import { containsPattern, searchOrNull } from './SqlText';

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.city, p.address, p.currency, p.status,
         to_char(p.expected_completion, 'YYYY-MM-DD') AS expected_completion, p.created_at, p.updated_at,
         c.total, c.available, c.reserved, c.sold, c.blocked
  FROM projects p
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE u.status = 'available')::int AS available,
           count(*) FILTER (WHERE u.status = 'reserved')::int AS reserved,
           count(*) FILTER (WHERE u.status = 'sold')::int AS sold,
           count(*) FILTER (WHERE u.status = 'blocked')::int AS blocked
    FROM units u WHERE u.project_id = p.id
  ) c ON true`;

const PROJECT_WHERE = `
  WHERE p.organization_id = :organizationId
    AND (CAST(:status AS text) IS NULL OR p.status = :status)
    AND (CAST(:term AS text) IS NULL OR p.name ILIKE :term OR p.city ILIKE :term)`;

const PROJECTS_SQL = `${PROJECT_SELECT} ${PROJECT_WHERE} ORDER BY p.created_at DESC, p.id DESC LIMIT :limit OFFSET :offset`;
const PROJECTS_COUNT_SQL = `SELECT count(*)::int AS total FROM projects p ${PROJECT_WHERE}`;
const PROJECT_SQL = `${PROJECT_SELECT} WHERE p.organization_id = :organizationId AND p.id = :id`;

const UNIT_SELECT = `
  SELECT u.id, u.project_id, u.number, u.type, u.status, u.bedrooms, u.bathrooms, u.area_sqm, u.floor,
         u.price, u.notes, u.created_at, u.updated_at
  FROM units u`;

const UNIT_WHERE = `
  WHERE u.organization_id = :organizationId AND u.project_id = :projectId
    AND (CAST(:status AS text) IS NULL OR u.status = :status)
    AND (CAST(:type AS text) IS NULL OR u.type = :type)
    AND (CAST(:term AS text) IS NULL OR u.number ILIKE :term OR u.notes ILIKE :term)`;

const UNITS_SQL = `${UNIT_SELECT} ${UNIT_WHERE} ORDER BY u.number_sort, u.number_key, u.id LIMIT :limit OFFSET :offset`;
const UNITS_COUNT_SQL = `SELECT count(*)::int AS total FROM units u ${UNIT_WHERE}`;
const UNIT_SQL = `${UNIT_SELECT} WHERE u.organization_id = :organizationId AND u.id = :id`;

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  currency: string;
  status: string;
  expected_completion: string | null;
  created_at: Date;
  updated_at: Date;
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
}

interface UnitRow {
  id: string;
  project_id: string;
  number: string;
  type: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: string | null;
  floor: number | null;
  price: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class InventoryQueries implements IInventoryQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findProjects(
    filter: ProjectListFilter,
  ): Promise<{ rows: ProjectReadModel[]; total: number }> {
    const search = searchOrNull(filter.search);
    const replacements = {
      organizationId: filter.organizationId,
      status: filter.status ?? null,
      term: search ? containsPattern(search) : null,
      limit: filter.pageSize,
      offset: offsetOf(filter),
    };
    const rows = await this.sequelize.query<ProjectRow>(PROJECTS_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(PROJECTS_COUNT_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toProject), total };
  }

  async findProject(organizationId: string, id: string): Promise<ProjectReadModel | null> {
    const rows = await this.sequelize.query<ProjectRow>(PROJECT_SQL, {
      replacements: { organizationId, id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toProject(rows[0]) : null;
  }

  async findUnits(filter: UnitListFilter): Promise<{ rows: UnitReadModel[]; total: number }> {
    const search = searchOrNull(filter.search);
    const replacements = {
      organizationId: filter.organizationId,
      projectId: filter.projectId,
      status: filter.status ?? null,
      type: filter.type ?? null,
      term: search ? containsPattern(search) : null,
      limit: filter.pageSize,
      offset: offsetOf(filter),
    };
    const rows = await this.sequelize.query<UnitRow>(UNITS_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(UNITS_COUNT_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toUnit), total };
  }

  async findUnit(organizationId: string, id: string): Promise<UnitReadModel | null> {
    const rows = await this.sequelize.query<UnitRow>(UNIT_SQL, {
      replacements: { organizationId, id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toUnit(rows[0]) : null;
  }
}

const toNumber = (value: string | null): number | null => (value === null ? null : Number(value));

function toProject(row: ProjectRow): ProjectReadModel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    city: row.city,
    address: row.address,
    currency: row.currency,
    status: row.status,
    expectedCompletion: row.expected_completion,
    unitCounts: {
      total: row.total,
      available: row.available,
      reserved: row.reserved,
      sold: row.sold,
      blocked: row.blocked,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toUnit(row: UnitRow): UnitReadModel {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    type: row.type,
    status: row.status,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    areaSqm: toNumber(row.area_sqm),
    floor: row.floor,
    price: toNumber(row.price),
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
