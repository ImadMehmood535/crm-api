import { Invite } from '@domain/aggregates/InviteAggregate/Invite';
import { MailMessage } from '@infrastructure/mail/abstraction/IMailer';

/** The invitation e-mail. The raw token exists only here and in the recipient's inbox. */
export function inviteMail(invite: Invite, token: string, appBaseUrl: string): MailMessage {
  const link = `${appBaseUrl.replace(/\/+$/, '')}/accept-invite/${token}`;
  return {
    to: invite.email,
    subject: `You're invited to set up ${invite.organizationName} on Invespy CRM`,
    text: [
      `Hello ${invite.firstName},`,
      '',
      `You have been invited to set up ${invite.organizationName} on Invespy CRM.`,
      `Accept the invitation: ${link}`,
      `This link expires on ${invite.expiresAt.toISOString()}.`,
    ].join('\n'),
  };
}
