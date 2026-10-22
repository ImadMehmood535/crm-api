import { META } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  developerQueries,
  organizationRepository,
  platformSuper,
  tenantUser,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { Organization } from '@domain/aggregates/OrganizationAggregate/Organization';
import { NotFoundError } from '@shared/errors/AppError';

import { ChangeDeveloperStatusCommand } from './ChangeDeveloperStatusCommand';
import { ChangeDeveloperStatusCommandHandler } from './ChangeDeveloperStatusCommandHandler';

describe('ChangeDeveloperStatusCommandHandler', () => {
  const setup = (status: 'active' | 'suspended' | null) => {
    const organizations = organizationRepository();
    organizations.findById.mockResolvedValue(
      status ? Organization.rehydrate('org-1', 'Palm', 'palm', status, null) : null,
    );
    const audit = auditLog();
    const handler = new ChangeDeveloperStatusCommandHandler(
      organizations,
      developerQueries(),
      audit,
      unitOfWork,
    );
    return { handler, organizations, audit };
  };

  it('should suspend an active company and audit old and new status', async () => {
    const { handler, organizations, audit } = setup('active');

    await handler.execute(
      new ChangeDeveloperStatusCommand(platformSuper, 'org-1', 'suspend', META),
    );

    expect(organizations.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspended' }),
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'developer.suspended',
        oldValues: { status: 'active' },
        newValues: { status: 'suspended' },
      }),
      {},
    );
  });

  it('should change and record nothing when the status is already the target', async () => {
    const { handler, organizations, audit } = setup('suspended');

    await handler.execute(
      new ChangeDeveloperStatusCommand(platformSuper, 'org-1', 'suspend', META),
    );

    expect(organizations.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('should reactivate a suspended company', async () => {
    const { handler, audit } = setup('suspended');

    await handler.execute(
      new ChangeDeveloperStatusCommand(platformSuper, 'org-1', 'reactivate', META),
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'developer.reactivated' }),
      {},
    );
  });

  it('should answer NOT_FOUND for an unknown company and refuse tenant users', async () => {
    await expect(
      setup(null).handler.execute(
        new ChangeDeveloperStatusCommand(platformSuper, 'x', 'suspend', META),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      setup('active').handler.execute(
        new ChangeDeveloperStatusCommand(tenantUser, 'org-1', 'suspend', META),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
