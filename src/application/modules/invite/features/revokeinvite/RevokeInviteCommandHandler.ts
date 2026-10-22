import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { IInviteQueries, INVITE_QUERIES } from '@infrastructure/queries/abstraction/IInviteQueries';
import {
  IInviteRepository,
  INVITE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IInviteRepository';
import { requirePlatform } from '@application/common/Authorization';

import { InviteResponse } from '../getinvites/InviteResponse';
import { inviteNotFound } from '../resendinvite/ResendInviteCommandHandler';
import { RevokeInviteCommand } from './RevokeInviteCommand';

@CommandHandler(RevokeInviteCommand)
export class RevokeInviteCommandHandler implements ICommandHandler<
  RevokeInviteCommand,
  InviteResponse
> {
  constructor(
    @Inject(INVITE_REPOSITORY) private readonly invites: IInviteRepository,
    @Inject(INVITE_QUERIES) private readonly inviteQueries: IInviteQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: RevokeInviteCommand): Promise<InviteResponse> {
    requirePlatform(command.actor);
    const invite = await this.invites.findById(command.id);
    if (!invite) throw inviteNotFound();
    invite.revoke();

    await this.unitOfWork.run(async (tx) => {
      await this.invites.update(invite, tx);
      await this.audit.record(
        {
          actorUserId: command.actor.userId,
          action: 'invite.revoked',
          entityType: 'invite',
          entityId: command.id,
          organizationId: null,
          oldValues: { status: 'pending' },
          newValues: { status: 'revoked' },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return InviteResponse.from((await this.inviteQueries.findById(command.id))!);
  }
}
