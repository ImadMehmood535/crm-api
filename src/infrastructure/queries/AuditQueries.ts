import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import { AuditListFilter, AuditRecordReadModel, IAuditQueries } from './abstraction/IAuditQueries';

interface Row {
  id: string;
  created_at: Date;
  action: string;
  entity_type: string;
  entity_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip: string | null;
}

const WHERE = `
  WHERE (CAST(:action AS text) IS NULL OR a.action = :action)
    AND (CAST(:entityType AS text) IS NULL OR a.entity_type = :entityType)
    AND (CAST(:organizationId AS uuid) IS NULL OR a.organization_id = :organizationId)`;

const LIST_SQL = `
  SELECT a.id, a.created_at, a.action, a.entity_type, a.entity_id, a.organization_id,
         o.name AS organization_name, u.id AS actor_id, u.email AS actor_email,
         u.first_name || ' ' || u.last_name AS actor_name, a.old_values, a.new_values, a.ip
  FROM audit_logs a
  LEFT JOIN organizations o ON o.id = a.organization_id
  LEFT JOIN users u ON u.id = a.actor_user_id
  ${WHERE}
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT :limit OFFSET :offset`;

const COUNT_SQL = `SELECT count(*)::int AS total FROM audit_logs a ${WHERE}`;

@Injectable()
export class AuditQueries implements IAuditQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findList(
    filter: AuditListFilter,
  ): Promise<{ rows: AuditRecordReadModel[]; total: number }> {
    const replacements = {
      action: filter.action ?? null,
      entityType: filter.entityType ?? null,
      organizationId: filter.organizationId ?? null,
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
}

function toReadModel(row: Row): AuditRecordReadModel {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    actor:
      row.actor_id && row.actor_email
        ? { id: row.actor_id, email: row.actor_email, name: row.actor_name ?? '' }
        : null,
    oldValues: row.old_values,
    newValues: row.new_values,
    ip: row.ip,
  };
}
