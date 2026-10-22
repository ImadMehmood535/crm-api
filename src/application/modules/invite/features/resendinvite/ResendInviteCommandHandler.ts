import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { NotFoundError } from '@shared/errors/AppError';
import { hashToken, newSecureToken } from '@shared/utils/SecureToken';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IMailer, MAILER } from '@infrastructure/mail/abstraction/IMailer';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { IInviteQueries, INVITE_QUERIES } from '@infrastructure/queries/abstraction/IInviteQueries';
import {
  IInviteRepository,
  INVITE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IInviteRepository';
import { requirePlatform } from '@application/common/Authorization';

import { InviteResponse } from '../getinvites/InviteResponse';
import { APP_BASE_URL_DEFAULT } from '../issueinvite/IssueInviteCommandHandler';
import { inviteMail } from '../../InviteMail';
import { ResendInviteCommand } from './ResendInviteCommand';

export const inviteNotFound = (): NotFoundError => new NotFoundError('Invite not found.');

/** New token + 7 more days for a pending or expired invite; the old link stops working. */
@CommandHandler(ResendInviteCommand)
export class ResendInviteCommandHandler implements ICommandHandler<
  ResendInviteCommand,
  InviteResponse
> {
  constructor(
    @Inject(INVITE_REPOSITORY) private readonly invites: IInviteRepository,
    @Inject(INVITE_QUERIES) private readonly inviteQueries: IInviteQueries,
    @Inject(MAILER) private readonly mailer: IMailer,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly config: ConfigService,
  ) {}

  async execute(command: ResendInviteCommand): Promise<InviteResponse> {
    requirePlatform(command.actor);
    const invite = await this.invites.findById(command.id);
    if (!invite) throw inviteNotFound();
    const token = newSecureToken();
    invite.renew(hashToken(token));

    const appBaseUrl = this.config.get<string>('APP_BASE_URL', APP_BASE_URL_DEFAULT);
    await this.unitOfWork.run(async (tx) => {
      await this.invites.update(invite, tx);
      await this.mailer.send(inviteMail(invite, token, appBaseUrl), tx);
      await this.audit.record(
        {
          actorUserId: command.actor.userId,
          action: 'invite.resent',
          entityType: 'invite',
          entityId: command.id,
          organizationId: null,
          newValues: { expiresAt: invite.expiresAt.toISOString() },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return InviteResponse.from((await this.inviteQueries.findById(command.id))!);
  }
}
