export const PLATFORM_STATS_QUERIES = Symbol('PLATFORM_STATS_QUERIES');

export type ActivityType =
  'organization.created' | 'organization.suspended' | 'organization.reactivated';

/** The frontend's `PlatformStats`. */
export interface PlatformStatsReadModel {
  counts: {
    organizations: { total: number; active: number; suspended: number };
    users: { total: number };
    projects: { total: number };
    units: { total: number };
  };
  recentActivity: Array<{
    type: ActivityType;
    organizationId: string;
    organizationName: string;
    at: string;
    actorName: string | null;
  }>;
  trends: { weeks: Array<{ weekStart: string; newOrganizations: number; newUsers: number }> };
}

export interface IPlatformStatsQueries {
  getStats(weeks: number): Promise<PlatformStatsReadModel>;
}
