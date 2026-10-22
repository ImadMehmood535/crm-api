import { ConfigService } from '@nestjs/config';

import { META, userRepository } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  inviteQueries,
  inviteRepository,
  mailer,
  organizationRepository,
  platformSuper,
  tenantUser,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';

import { IssueInviteCommand } from './IssueInviteCommand';
import { IssueInviteCommandHandler } from './IssueInviteCommandHandler';

const request = {
  email: 'Founder@Harbor.example.com',
  firstName: 'Ali',
  lastName: 'Raza',
  organizationName: 'Harbor Homes',
  slug: 'harbor-homes',
};

describe('IssueInviteCommandHandler', () => {
  const setup = () => {
    const invites = inviteRepository();
    const organizations = organizationRepository();
    const users = userRepository();
    const mail = mailer();
    const audit = auditLog();
    const handler = new IssueInviteCommandHandler(
      invites,
      inviteQueries(),
      organizations,
      users,
      mail,
      audit,
      unitOfWork,
      new ConfigService({ APP_BASE_URL: 'https://crm.example.com/' }),
    );
    return { handler, invites, organizations, users, mail, audit };
  };

  it('should store only the token hash and e-mail the link with the raw token', async () => {
    const { handler, invites, mail, audit } = setup();

    await handler.execute(new IssueInviteCommand(platformSuper, request, META));

    const saved = invites.save.mock.calls[0][0];
    expect(saved.email).toBe('founder@harbor.example.com');
    const message = mail.send.mock.calls[0][0];
    expect(message.to).toBe('founder@harbor.example.com');
    const token = /accept-invite\/(\S+)/.exec(message.text)![1];
    expect(message.text).toContain('https://crm.example.com/accept-invite/');
    expect(saved.tokenHash).not.toBe(token);
    expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.issued' }),
      {},
    );
  });

  it.each([
    ['a company holds the slug', 'SLUG_CONFLICT'],
    ['the email has an account', 'EMAIL_CONFLICT'],
    ['the email has a live invite', 'INVITE_PENDING'],
  ])('should answer 409 when %s', async (_, code) => {
    const { handler, organizations, users, invites, mail } = setup();
    if (code === 'SLUG_CONFLICT') organizations.slugExists.mockResolvedValue(true);
    if (code === 'EMAIL_CONFLICT') users.emailExists.mockResolvedValue(true);
    if (code === 'INVITE_PENDING') invites.livePendingEmailExists.mockResolvedValue(true);

    await expect(
      handler.execute(new IssueInviteCommand(platformSuper, request, META)),
    ).rejects.toMatchObject({
      status: 409,
      code,
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('should refuse tenant users and reserved slugs', async () => {
    const { handler } = setup();

    await expect(
      handler.execute(new IssueInviteCommand(tenantUser, request, META)),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(
      handler.execute(new IssueInviteCommand(platformSuper, { ...request, slug: 'www' }, META)),
    ).rejects.toMatchObject({ code: 'SLUG_RESERVED' });
  });
});
