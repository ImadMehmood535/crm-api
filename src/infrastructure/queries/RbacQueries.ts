import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import {
  IRbacQueries,
  PermissionModuleReadModel,
  RoleListFilter,
  RoleReadModel,
} from './abstraction/IRbacQueries';
import { HEAD_CODES_SQL } from './EffectivePermissionsSql';
import { containsPattern, searchOrNull } from './SqlText';

const CATALOGUE_SQL = `
  SELECT m.code AS module, m.name AS module_label, p.action, p.name AS action_label, p.code
  FROM modules m JOIN permissions p ON p.module_id = m.id
  WHERE m.is_active
  ORDER BY m.sort_order, p.sort_order`;

// The owner and "Admin" roles list the whole catalogue, "Department Head" its set, others their grants.
const ROLE_SELECT = `
  SELECT r.id, r.name, r.code, r.description, r.created_at,
         (r.is_system_role OR r.level_role IS NOT NULL) AS is_system_role,
         (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
         CASE WHEN r.is_system_role OR r.level_role = 'admin'
           THEN (SELECT coalesce(array_agg(p.code ORDER BY p.code), '{}') FROM permissions p)
           WHEN r.level_role = 'department_head'
           THEN (SELECT coalesce(array_agg(p.code ORDER BY p.code), '{}') FROM permissions p
                 WHERE p.code IN (${HEAD_CODES_SQL}))
           ELSE (SELECT coalesce(array_agg(p.code ORDER BY p.code), '{}')
                 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id)
         END AS permissions
  FROM roles r`;

const ROLE_WHERE = `
  WHERE r.organization_id = :organizationId AND r.is_active
    AND (CAST(:term AS text) IS NULL OR r.name ILIKE :term)`;

const ROLE_LIST_SQL = `${ROLE_SELECT} ${ROLE_WHERE}
  ORDER BY r.is_system_role DESC, (r.level_role IS NOT NULL) DESC, lower(r.name), r.id LIMIT :limit OFFSET :offset`;
const ROLE_COUNT_SQL = `SELECT count(*)::int AS total FROM roles r ${ROLE_WHERE}`;
const ROLE_BY_ID_SQL = `${ROLE_SELECT} WHERE r.organization_id = :organizationId AND r.id = :id AND r.is_active`;

interface RoleRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system_role: boolean;
  created_at: Date;
  user_count: number;
  permissions: string[];
}

@Injectable()
export class RbacQueries implements IRbacQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async catalogue(): Promise<PermissionModuleReadModel[]> {
    const rows = await this.sequelize.query<{
      module: string;
      module_label: string;
      action: string;
      action_label: string;
      code: string;
    }>(CATALOGUE_SQL, { type: QueryTypes.SELECT });
    const modules: PermissionModuleReadModel[] = [];
    for (const row of rows) {
      let module = modules.find((m) => m.module === row.module);
      if (!module) {
        module = { module: row.module, label: row.module_label, actions: [] };
        modules.push(module);
      }
      module.actions.push({ action: row.action, label: row.action_label, code: row.code });
    }
    return modules;
  }

  async allCodes(): Promise<string[]> {
    return (await this.catalogue()).flatMap((m) => m.actions.map((a) => a.code));
  }

  async findRoles(filter: RoleListFilter): Promise<{ rows: RoleReadModel[]; total: number }> {
    const search = searchOrNull(filter.search);
    const replacements = {
      organizationId: filter.organizationId,
      term: search ? containsPattern(search) : null,
      limit: filter.pageSize,
      offset: offsetOf(filter),
    };
    const rows = await this.sequelize.query<RoleRow>(ROLE_LIST_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(ROLE_COUNT_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toRole), total };
  }

  async findRole(organizationId: string, id: string): Promise<RoleReadModel | null> {
    const rows = await this.sequelize.query<RoleRow>(ROLE_BY_ID_SQL, {
      replacements: { organizationId, id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toRole(rows[0]) : null;
  }
}

function toRole(row: RoleRow): RoleReadModel {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    isSystem: row.is_system_role,
    permissions: row.permissions,
    userCount: row.user_count,
    createdAt: row.created_at.toISOString(),
  };
}
