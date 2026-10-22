import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import {
  ActivityType,
  IPlatformStatsQueries,
  PlatformStatsReadModel,
} from './abstraction/IPlatformStatsQueries';

const RECENT_ACTIVITY_LIMIT = 10;

const ORGANIZATION_COUNTS_SQL = `
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE status = 'active')::int AS active,
         count(*) FILTER (WHERE status = 'suspended')::int AS suspended
  FROM organizations`;

const TENANT_USERS_SQL =
  'SELECT count(*)::int AS total FROM users WHERE organization_id IS NOT NULL';

// date_trunc('week') starts weeks on Monday (ISO).
const TRENDS_SQL = `
  SELECT to_char(w.week_start, 'YYYY-MM-DD') AS week_start,
         (SELECT count(*)::int FROM organizations o
           WHERE o.created_at >= w.week_start AND o.created_at < w.week_start + interval '7 days') AS new_organizations,
         (SELECT count(*)::int FROM users u
           WHERE u.organization_id IS NOT NULL
             AND u.created_at >= w.week_start AND u.created_at < w.week_start + interval '7 days') AS new_users
  FROM generate_series(date_trunc('week', now()) - make_interval(weeks => :weeks - 1),
                       date_trunc('week', now()), interval '1 week') AS w(week_start)
  ORDER BY w.week_start`;

const ACTIVITY_SQL = `
  SELECT a.action, a.organization_id, o.name AS organization_name, a.created_at,
         CASE WHEN u.id IS NULL THEN NULL ELSE u.first_name || ' ' || u.last_name END AS actor_name
  FROM audit_logs a
  JOIN organizations o ON o.id = a.organization_id
  LEFT JOIN users u ON u.id = a.actor_user_id
  WHERE a.action IN ('developer.onboarded', 'invite.accepted', 'developer.suspended', 'developer.reactivated')
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT :limit`;

const ACTIVITY_TYPE: Record<string, ActivityType> = {
  'developer.onboarded': 'organization.created',
  'invite.accepted': 'organization.created',
  'developer.suspended': 'organization.suspended',
  'developer.reactivated': 'organization.reactivated',
};

@Injectable()
export class PlatformStatsQueries implements IPlatformStatsQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async getStats(weeks: number): Promise<PlatformStatsReadModel> {
    const select = { type: QueryTypes.SELECT } as const;
    const [[organizations], [users], trends, activity] = await Promise.all([
      this.sequelize.query<{ total: number; active: number; suspended: number }>(
        ORGANIZATION_COUNTS_SQL,
        select,
      ),
      this.sequelize.query<{ total: number }>(TENANT_USERS_SQL, select),
      this.sequelize.query<{ week_start: string; new_organizations: number; new_users: number }>(
        TRENDS_SQL,
        {
          ...select,
          replacements: { weeks },
        },
      ),
      this.sequelize.query<{
        action: string;
        organization_id: string;
        organization_name: string;
        created_at: Date;
        actor_name: string | null;
      }>(ACTIVITY_SQL, { ...select, replacements: { limit: RECENT_ACTIVITY_LIMIT } }),
    ]);
    return {
      counts: {
        organizations,
        users,
        // TODO(projects-and-units): count real projects and units.
        projects: { total: 0 },
        units: { total: 0 },
      },
      recentActivity: activity.map((row) => ({
        type: ACTIVITY_TYPE[row.action],
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        at: row.created_at.toISOString(),
        actorName: row.actor_name,
      })),
      trends: {
        weeks: trends.map((row) => ({
          weekStart: row.week_start,
          newOrganizations: row.new_organizations,
          newUsers: row.new_users,
        })),
      },
    };
  }
}
