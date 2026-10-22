import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import {
  DeveloperListFilter,
  DeveloperReadModel,
  IDeveloperQueries,
} from './abstraction/IDeveloperQueries';
import { containsPattern, searchOrNull } from './SqlText';

interface Row {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  created_at: Date;
  user_count: number;
  owner_id: string | null;
  owner_email: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
}

// A company's owner is the holder of its built-in developer_super_user role.
const FROM = `
  FROM organizations o
  LEFT JOIN LATERAL (
    SELECT u.id, u.email, u.first_name, u.last_name
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.organization_id = o.id AND r.code = 'developer_super_user'
    WHERE u.organization_id = o.id
    ORDER BY u.created_at
    LIMIT 1
  ) owner ON true
  WHERE (CAST(:status AS text) IS NULL OR o.status = :status)
    AND (CAST(:term AS text) IS NULL OR o.name ILIKE :term OR o.slug ILIKE :term
         OR owner.email ILIKE :term OR owner.first_name ILIKE :term OR owner.last_name ILIKE :term)
    AND (CAST(:id AS uuid) IS NULL OR o.id = :id)`;

const SELECT = `
  SELECT o.id, o.name, o.slug, o.status, o.created_at,
         (SELECT count(*)::int FROM users c WHERE c.organization_id = o.id) AS user_count,
         owner.id AS owner_id, owner.email AS owner_email,
         owner.first_name AS owner_first_name, owner.last_name AS owner_last_name`;

const LIST_SQL = `${SELECT} ${FROM} ORDER BY o.created_at DESC, o.id DESC LIMIT :limit OFFSET :offset`;
const COUNT_SQL = `SELECT count(*)::int AS total ${FROM}`;
const BY_ID_SQL = `${SELECT} ${FROM}`;

@Injectable()
export class DeveloperQueries implements IDeveloperQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findList(
    filter: DeveloperListFilter,
  ): Promise<{ rows: DeveloperReadModel[]; total: number }> {
    const search = searchOrNull(filter.search);
    const replacements = {
      status: filter.status ?? null,
      term: search ? containsPattern(search) : null,
      id: null,
      limit: filter.pageSize,
      offset: offsetOf(filter),
    };
    const rows = await this.sequelize.query<Row>(LIST_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(COUNT_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toReadModel), total };
  }

  async findById(id: string): Promise<DeveloperReadModel | null> {
    const rows = await this.sequelize.query<Row>(BY_ID_SQL, {
      replacements: { status: null, term: null, id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toReadModel(rows[0]) : null;
  }
}

function toReadModel(row: Row): DeveloperReadModel {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    userCount: row.user_count,
    superUser:
      row.owner_id && row.owner_email
        ? {
            id: row.owner_id,
            email: row.owner_email,
            name: `${row.owner_first_name} ${row.owner_last_name}`,
          }
        : null,
  };
}
