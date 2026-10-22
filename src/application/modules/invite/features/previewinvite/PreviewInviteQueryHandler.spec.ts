import {
  inviteQueries,
  platformAdmin,
  tenantUser,
} from '../../../../../../test/support/platform-mocks';
import { hashToken } from '@shared/utils/SecureToken';

import { GetInvitesQuery } from '../getinvites/GetInvitesQuery';
import { GetInvitesQueryHandler } from '../getinvites/GetInvitesQueryHandler';
import { PreviewInviteQuery } from './PreviewInviteQuery';
import { PreviewInviteQueryHandler } from './PreviewInviteQueryHandler';

describe('Invite query handlers', () => {
  it('should preview by the hash of the token', async () => {
    const queries = inviteQueries();
    queries.findLivePreview.mockResolvedValue({
      email: 'a@b.co',
      firstName: 'Ali',
      lastName: 'Raza',
      organizationName: 'Harbor',
      slug: 'harbor',
      expiresAt: '2026-10-30T00:00:00.000Z',
    });

    const result = await new PreviewInviteQueryHandler(queries).execute(
      new PreviewInviteQuery('raw'),
    );

    expect(queries.findLivePreview).toHaveBeenCalledWith(hashToken('raw'));
    expect(result.slug).toBe('harbor');
  });

  it('should answer INVITE_INVALID when no live invite matches', async () => {
    const queries = inviteQueries();
    queries.findLivePreview.mockResolvedValue(null);

    await expect(
      new PreviewInviteQueryHandler(queries).execute(new PreviewInviteQuery('x')),
    ).rejects.toMatchObject({
      code: 'INVITE_INVALID',
    });
  });

  it('should page invites for platform users only', async () => {
    const result = await new GetInvitesQueryHandler(inviteQueries()).execute(
      new GetInvitesQuery(platformAdmin, { page: 1, pageSize: 20, status: 'expired' }),
    );

    expect(result.meta.total).toBe(1);
    await expect(
      new GetInvitesQueryHandler(inviteQueries()).execute(
        new GetInvitesQuery(tenantUser, { page: 1, pageSize: 20 }),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
