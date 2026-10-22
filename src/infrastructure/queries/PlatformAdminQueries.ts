import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { PageRequest, offsetOf } from '@shared/utils/Pagination';

import { IPlatformAdminQueries, PlatformAdminReadModel } from './abstraction/IPlatformAdminQueries';

interface Row {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_super: boolean;
  status: string;
  created_at: Date;
}

const SELECT = `
  SELECT u.id, u.email, u.first_name, u.last_name, u.status, u.created_at,
         EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.organization_id IS NULL AND r.code = 'platform_super_user') AS is_super
  FROM users u
  WHERE u.organization_id IS NULL`;

const LIST_SQL = `${SELECT} ORDER BY u.created_at, u.id LIMIT :limit OFFSET :offset`;
const BY_ID_SQL = `${SELECT} AND u.id = :id`;

@Injectable()
export class PlatformAdminQueries implements IPlatformAdminQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findList(page: PageRequest): Promise<{ rows: PlatformAdminReadModel[]; total: number }> {
    const rows = await this.sequelize.query<Row>(LIST_SQL, {
      replacements: { limit: page.pageSize, offset: offsetOf(page) },
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM users WHERE organization_id IS NULL',
      { type: QueryTypes.SELECT },
    );
    return { rows: rows.map(toReadModel), total };
  }

  async findById(id: string): Promise<PlatformAdminReadModel | null> {
    const rows = await this.sequelize.query<Row>(BY_ID_SQL, {
      replacements: { id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toReadModel(rows[0]) : null;
  }
}

function toReadModel(row: Row): PlatformAdminReadModel {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.is_super ? 'platform_super_user' : 'platform_admin',
    isActive: row.status === 'active',
    createdAt: row.created_at.toISOString(),
  };
}
