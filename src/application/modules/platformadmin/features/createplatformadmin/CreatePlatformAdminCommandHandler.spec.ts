import { META, passwordHasher, userRepository } from '../../../../../../test/support/auth-mocks';
import {
  adminQueries,
  auditLog,
  platformAdmin,
  platformSuper,
  roleRepository,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { User } from '@domain/aggregates/UserAggregate/User';

import { CreatePlatformAdminCommand } from './CreatePlatformAdminCommand';
import { CreatePlatformAdminCommandHandler } from './CreatePlatformAdminCommandHandler';

const request = { email: 'Ana@Invespy.example.com', firstName: 'Ana', lastName: 'Lee' };

describe('CreatePlatformAdminCommandHandler', () => {
  const setup = () => {
    const users = userRepository();
    users.save.mockImplementation((u: User) =>
      Promise.resolve(
        User.rehydrate('admin-1', null, u.email, u.firstName, u.lastName, u.status, u.createdBy),
      ),
    );
    const roles = roleRepository();
    const handler = new CreatePlatformAdminCommandHandler(
      users,
      roles,
      adminQueries(),
      passwordHasher(),
      auditLog(),
      unitOfWork,
    );
    return { handler, users, roles };
  };

  it('should create a must-reset platform admin and return the one-time password', async () => {
    const { handler, users } = setup();

    const result = await handler.execute(
      new CreatePlatformAdminCommand(platformSuper, request, META),
    );

    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@invespy.example.com' }),
      'hashed',
      true,
      {},
    );
    expect(users.assignRole).toHaveBeenCalledWith(
      'admin-1',
      'role-admin',
      platformSuper.userId,
      {},
    );
    expect(result.temporaryPassword).toMatch(/^Tmp-/);
  });

  it('should be reserved to the platform super user', async () => {
    await expect(
      setup().handler.execute(new CreatePlatformAdminCommand(platformAdmin, request, META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('should answer EMAIL_CONFLICT for a registered email', async () => {
    const { handler, users } = setup();
    users.emailExists.mockResolvedValue(true);

    await expect(
      handler.execute(new CreatePlatformAdminCommand(platformSuper, request, META)),
    ).rejects.toMatchObject({
      code: 'EMAIL_CONFLICT',
    });
  });

  it('should fail loudly when the platform roles were never seeded', async () => {
    const { handler, roles } = setup();
    roles.findPlatformRoleId.mockResolvedValue(null);

    await expect(
      handler.execute(new CreatePlatformAdminCommand(platformSuper, request, META)),
    ).rejects.toThrow('Platform roles are not seeded');
  });
});
