import { META, sessionRepository, userRepository } from '../../../../../../test/support/auth-mocks';
import {
  adminQueries,
  adminReadModel,
  auditLog,
  platformAdmin,
  platformSuper,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { User } from '@domain/aggregates/UserAggregate/User';
import { NotFoundError } from '@shared/errors/AppError';

import { DeactivatePlatformAdminCommand } from './DeactivatePlatformAdminCommand';
import { DeactivatePlatformAdminCommandHandler } from './DeactivatePlatformAdminCommandHandler';

describe('DeactivatePlatformAdminCommandHandler', () => {
  const setup = (target = adminReadModel()) => {
    const users = userRepository();
    users.findById.mockResolvedValue(
      User.rehydrate(target.id, null, target.email, 'Ana', 'Lee', 'active', null),
    );
    users.countOtherActivePlatformSuperUsers.mockResolvedValue(0);
    const sessions = sessionRepository();
    const audit = auditLog();
    const handler = new DeactivatePlatformAdminCommandHandler(
      users,
      sessions,
      adminQueries(target),
      audit,
      unitOfWork,
    );
    return { handler, users, sessions, audit };
  };

  it('should deactivate the admin, end their sessions and audit it', async () => {
    const { handler, users, sessions, audit } = setup();

    await handler.execute(new DeactivatePlatformAdminCommand(platformSuper, 'admin-1', META));

    expect(users.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive' }), {});
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('admin-1', 'account_deactivated', {});
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform_admin.deactivated' }),
      {},
    );
  });

  it('should protect the last active platform super user with LAST_SUPER_USER', async () => {
    const { handler, users } = setup(adminReadModel({ role: 'platform_super_user' }));

    await expect(
      handler.execute(new DeactivatePlatformAdminCommand(platformSuper, 'admin-1', META)),
    ).rejects.toMatchObject({ status: 409, code: 'LAST_SUPER_USER' });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('should allow deactivating a super user when another active one remains', async () => {
    const { handler, users } = setup(adminReadModel({ role: 'platform_super_user' }));
    users.countOtherActivePlatformSuperUsers.mockResolvedValue(1);

    await handler.execute(new DeactivatePlatformAdminCommand(platformSuper, 'admin-1', META));

    expect(users.update).toHaveBeenCalled();
  });

  it('should refuse platform admins and answer NOT_FOUND for unknown users', async () => {
    await expect(
      setup().handler.execute(new DeactivatePlatformAdminCommand(platformAdmin, 'admin-1', META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    const missing = new DeactivatePlatformAdminCommandHandler(
      userRepository(),
      sessionRepository(),
      adminQueries(null),
      auditLog(),
      unitOfWork,
    );
    await expect(
      missing.execute(new DeactivatePlatformAdminCommand(platformSuper, 'x', META)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
