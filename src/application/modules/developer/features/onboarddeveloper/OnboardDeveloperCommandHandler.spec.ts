import { META, passwordHasher, userRepository } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  developerQueries,
  inviteRepository,
  organizationRepository,
  platformSuper,
  roleRepository,
  tenantUser,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { User } from '@domain/aggregates/UserAggregate/User';

import { OnboardDeveloperCommand } from './OnboardDeveloperCommand';
import { OnboardDeveloperCommandHandler } from './OnboardDeveloperCommandHandler';

const owner = { email: 'Owner@Palm.example.com', firstName: 'Sara', lastName: 'Khan' };

describe('OnboardDeveloperCommandHandler', () => {
  const setup = () => {
    const organizations = organizationRepository();
    const users = userRepository();
    users.save.mockImplementation((u: User) =>
      Promise.resolve(
        User.rehydrate(
          'owner-1',
          u.organizationId,
          u.email,
          u.firstName,
          u.lastName,
          u.status,
          u.createdBy,
        ),
      ),
    );
    const invites = inviteRepository();
    const audit = auditLog();
    const handler = new OnboardDeveloperCommandHandler(
      organizations,
      users,
      roleRepository(),
      invites,
      developerQueries(),
      passwordHasher(),
      audit,
      unitOfWork,
    );
    return { handler, organizations, users, invites, audit };
  };
  const command = (actor = platformSuper, slug = 'palm-estates') =>
    new OnboardDeveloperCommand(actor, 'Palm Estates', slug, owner, META);

  it('should create the company, owner role and must-reset owner, audit it and return the one-time password', async () => {
    const { handler, users, audit } = setup();

    const result = await handler.execute(command());

    expect(users.save).toHaveBeenCalledWith(expect.any(User), 'hashed', true, {});
    expect(users.assignRole).toHaveBeenCalledWith('owner-1', 'role-1', platformSuper.userId, {});
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'developer.onboarded',
        organizationId: 'org-1',
        ip: '10.0.0.1',
      }),
      {},
    );
    expect(result.superUser).toEqual({ id: 'owner-1', email: 'owner@palm.example.com' });
    expect(result.temporaryPassword).toMatch(/^Tmp-/);
  });

  it('should refuse tenant users', async () => {
    await expect(setup().handler.execute(command(tenantUser))).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('should answer SLUG_RESERVED before touching the database', async () => {
    const { handler, organizations } = setup();

    await expect(handler.execute(command(platformSuper, 'admin'))).rejects.toMatchObject({
      code: 'SLUG_RESERVED',
    });
    expect(organizations.slugExists).not.toHaveBeenCalled();
  });

  it('should answer SLUG_CONFLICT when a company or a live invite holds the slug', async () => {
    const { handler, invites } = setup();
    invites.livePendingSlugExists.mockResolvedValue(true);

    await expect(handler.execute(command())).rejects.toMatchObject({
      status: 409,
      code: 'SLUG_CONFLICT',
    });
  });

  it('should answer EMAIL_CONFLICT when the owner email is registered', async () => {
    const { handler, users, organizations } = setup();
    users.emailExists.mockResolvedValue(true);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'EMAIL_CONFLICT' });
    expect(organizations.save).not.toHaveBeenCalled();
  });
});
