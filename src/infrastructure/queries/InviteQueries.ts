import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import {
  IInviteQueries,
  InviteListFilter,
  InvitePreviewReadModel,
  InviteReadModel,
} from './abstraction/IInviteQueries';

interface Row {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  slug: string;
  status: InviteReadModel['status'];
  expires_at: Date;
  created_at: Date;
}

const STATUS = `CASE WHEN i.status = 'pending' AND i.expires_at < now() THEN 'expired' ELSE i.status END`;
const SELECT = `SELECT i.id, i.email, i.first_name, i.last_name, i.organization_name, i.slug,
  ${STATUS} AS status, i.expires_at, i.created_at FROM invites i`;

const LIST_WHERE = `WHERE (CAST(:status AS text) IS NULL OR ${STATUS} = :status)`;
const LIST_SQL = `${SELECT} ${LIST_WHERE} ORDER BY i.created_at DESC, i.id DESC LIMIT :limit OFFSET :offset`;
const COUNT_SQL = `SELECT count(*)::int AS total FROM invites i ${LIST_WHERE}`;
const BY_ID_SQL = `${SELECT} WHERE i.id = :id`;
const LIVE_PREVIEW_SQL = `${SELECT} WHERE i.token_hash = :tokenHash AND i.status = 'pending' AND i.expires_at >= now()`;

@Injectable()
export class InviteQueries implements IInviteQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findList(filter: InviteListFilter): Promise<{ rows: InviteReadModel[]; total: number }> {
    const replacements = {
      status: filter.status ?? null,
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

  async findById(id: string): Promise<InviteReadModel | null> {
    const rows = await this.sequelize.query<Row>(BY_ID_SQL, {
      replacements: { id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toReadModel(rows[0]) : null;
  }

  async findLivePreview(tokenHash: string): Promise<InvitePreviewReadModel | null> {
    const rows = await this.sequelize.query<Row>(LIVE_PREVIEW_SQL, {
      replacements: { tokenHash },
      type: QueryTypes.SELECT,
    });
    if (!rows.length) return null;
    const { email, firstName, lastName, organizationName, slug, expiresAt } = toReadModel(rows[0]);
    return { email, firstName, lastName, organizationName, slug, expiresAt };
  }
}

function toReadModel(row: Row): InviteReadModel {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    organizationName: row.organization_name,
    slug: row.slug,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}
