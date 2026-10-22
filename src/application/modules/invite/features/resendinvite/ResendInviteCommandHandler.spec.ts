import { ConfigService } from '@nestjs/config';

import { META } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  inviteQueries,
  inviteRepository,
  mailer,
  pendingInvite,
  platformSuper,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { RevokeInviteCommand } from '../revokeinvite/RevokeInviteCommand';
import { RevokeInviteCommandHandler } from '../revokeinvite/RevokeInviteCommandHandler';
import { ResendInviteCommand } from './ResendInviteCommand';
import { ResendInviteCommandHandler } from './ResendInviteCommandHandler';

describe('Resend / revoke invite handlers', () => {
  const setup = () => {
    const invites = inviteRepository();
    const mail = mailer();
    const audit = auditLog();
    const resend = new ResendInviteCommandHandler(
      invites,
      inviteQueries(),
      mail,
      audit,
      unitOfWork,
      new ConfigService({}),
    );
    const revoke = new RevokeInviteCommandHandler(invites, inviteQueries(), audit, unitOfWork);
    return { invites, mail, audit, resend, revoke };
  };

  it('should renew the token, mail the new link and audit the resend', async () => {
    const { invites, mail, audit, resend } = setup();
    const invite = pendingInvite();
    const oldHash = invite.tokenHash;
    invites.findById.mockResolvedValue(invite);

    await resend.execute(new ResendInviteCommand(platformSuper, 'inv-1', META));

    expect(invites.update.mock.calls[0][0].tokenHash).not.toBe(oldHash);
    expect(mail.send.mock.calls[0][0].text).toContain('http://localhost:3200/accept-invite/');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.resent' }),
      {},
    );
  });

  it('should revoke a pending invite and refuse a second revoke with INVITE_NOT_PENDING', async () => {
    const { invites, revoke } = setup();
    const invite = pendingInvite();
    invites.findById.mockResolvedValue(invite);

    await revoke.execute(new RevokeInviteCommand(platformSuper, 'inv-1', META));

    expect(invite.status).toBe('revoked');
    await expect(
      revoke.execute(new RevokeInviteCommand(platformSuper, 'inv-1', META)),
    ).rejects.toMatchObject({
      code: 'INVITE_NOT_PENDING',
    });
  });

  it('should answer NOT_FOUND for an unknown invite', async () => {
    const { resend, revoke } = setup();

    await expect(
      resend.execute(new ResendInviteCommand(platformSuper, 'x', META)),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      revoke.execute(new RevokeInviteCommand(platformSuper, 'x', META)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
