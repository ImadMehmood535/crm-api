import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import {
  ITenantUserQueries,
  TenantUserListFilter,
  TenantUserReadModel,
  Viewer,
} from './abstraction/ITenantUserQueries';
import { effectivePermissionsSql } from './EffectivePermissionsSql';
import { containsPattern, searchOrNull } from './SqlText';
import { VISIBLE_USERS_CTE, effectiveLevelSql } from './VisibilitySql';

const SELECT = `
  SELECT u.id, u.email, u.first_name, u.last_name, u.status, u.last_login_at, u.created_at,
         ${effectiveLevelSql('u')} AS level,
         (SELECT coalesce(json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name), '[]')
            FROM team_members tm JOIN teams t ON t.id = tm.team_id AND t.is_active
           WHERE tm.user_id = u.id) AS teams,
         EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.is_system_role AND r.is_active) AS is_owner,
         (SELECT coalesce(json_agg(json_build_object('id', r.id, 'name', r.name, 'code', r.code)
                                   ORDER BY r.is_system_role DESC, r.name), '[]')
            FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.is_active) AS roles,
         (SELECT coalesce(array_agg(code ORDER BY code), '{}') FROM (${effectivePermissionsSql('u.id')}) x) AS permissions
  FROM users u`;

const WHERE = `
  WHERE u.organization_id = :organizationId
    AND (CAST(:status AS text) IS NULL OR u.status = :status)
    AND (CAST(:term AS text) IS NULL
         OR (u.first_name || ' ' || u.last_name) ILIKE :term OR u.email ILIKE :term)`;

const ORDER = 'ORDER BY u.created_at, u.id LIMIT :limit OFFSET :offset';
const SCOPE = 'AND u.id IN (SELECT id FROM visible)';
const BY_ID = 'WHERE u.organization_id = :organizationId AND u.id = :id';

// Owners see the whole company; everyone else sees through the hierarchy (VisibilitySql).
const LIST_SQL = `${SELECT} ${WHERE} ${ORDER}`;
const COUNT_SQL = `SELECT count(*)::int AS total FROM users u ${WHERE}`;
const BY_ID_SQL = `${SELECT} ${BY_ID}`;
const SCOPED_LIST_SQL = `WITH ${VISIBLE_USERS_CTE} ${SELECT} ${WHERE} ${SCOPE} ${ORDER}`;
const SCOPED_COUNT_SQL = `WITH ${VISIBLE_USERS_CTE} SELECT count(*)::int AS total FROM users u ${WHERE} ${SCOPE}`;
const SCOPED_BY_ID_SQL = `WITH ${VISIBLE_USERS_CTE} ${SELECT} ${BY_ID} ${SCOPE}`;

const scoped = (viewer: Viewer): boolean => viewer.level !== 'owner';
const viewerReplacements = (viewer: Viewer): Record<string, string> => ({
  viewerId: viewer.userId,
  viewerLevel: viewer.level,
});

interface Row {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: TenantUserReadModel['status'];
  level: TenantUserReadModel['level'];
  teams: TenantUserReadModel['teams'];
  last_login_at: Date | null;
  created_at: Date;
  is_owner: boolean;
  roles: TenantUserReadModel['roles'];
  permissions: string[];
}

@Injectable()
export class TenantUserQueries implements ITenantUserQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findList(
    filter: TenantUserListFilter,
  ): Promise<{ rows: TenantUserReadModel[]; total: number }> {
    const search = searchOrNull(filter.search);
    const replacements = {
      organizationId: filter.organizationId,
      status: filter.status ?? null,
      term: search ? containsPattern(search) : null,
      limit: filter.pageSize,
      offset: offsetOf(filter),
      ...viewerReplacements(filter.viewer),
    };
    const isScoped = scoped(filter.viewer);
    const rows = await this.sequelize.query<Row>(isScoped ? SCOPED_LIST_SQL : LIST_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const countSql = isScoped ? SCOPED_COUNT_SQL : COUNT_SQL;
    const [{ total }] = await this.sequelize.query<{ total: number }>(countSql, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toReadModel), total };
  }

  async findById(
    organizationId: string,
    id: string,
    viewer: Viewer,
  ): Promise<TenantUserReadModel | null> {
    const rows = await this.sequelize.query<Row>(scoped(viewer) ? SCOPED_BY_ID_SQL : BY_ID_SQL, {
      replacements: { organizationId, id, ...viewerReplacements(viewer) },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toReadModel(rows[0]) : null;
  }
}

function toReadModel(row: Row): TenantUserReadModel {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    level: row.level,
    isOwner: row.is_owner,
    roles: row.roles,
    teams: row.teams,
    permissions: row.permissions,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
