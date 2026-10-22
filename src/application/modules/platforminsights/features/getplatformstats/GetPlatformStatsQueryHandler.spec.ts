import { platformAdmin, tenantUser } from '../../../../../../test/support/platform-mocks';

import { GetAuditLogQuery } from '../getauditlog/GetAuditLogQuery';
import { GetAuditLogQueryHandler } from '../getauditlog/GetAuditLogQueryHandler';
import { GetPlatformStatsQuery } from './GetPlatformStatsQuery';
import { GetPlatformStatsQueryHandler } from './GetPlatformStatsQueryHandler';

describe('Platform insights handlers', () => {
  it('should pass the week count through for platform users and refuse tenants', async () => {
    const stats = {
      getStats: jest
        .fn()
        .mockResolvedValue({ counts: {}, recentActivity: [], trends: { weeks: [] } }),
    };
    const handler = new GetPlatformStatsQueryHandler(stats);

    await handler.execute(new GetPlatformStatsQuery(platformAdmin, 12));

    expect(stats.getStats).toHaveBeenCalledWith(12);
    await expect(handler.execute(new GetPlatformStatsQuery(tenantUser, 8))).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('should page the audit trail with its filters', async () => {
    const audit = { findList: jest.fn().mockResolvedValue({ rows: [], total: 0 }) };
    const filter = { page: 1, pageSize: 20, action: 'developer.suspended' };

    const result = await new GetAuditLogQueryHandler(audit).execute(
      new GetAuditLogQuery(platformAdmin, filter),
    );

    expect(audit.findList).toHaveBeenCalledWith(filter);
    expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 0 });
  });
});
