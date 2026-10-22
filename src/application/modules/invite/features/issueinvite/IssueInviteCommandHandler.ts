import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ConflictError } from '@shared/errors/AppError';
import { hashToken, newSecureToken } from '@shared/utils/SecureToken';
import { Invite } from '@domain/aggregates/InviteAggregate/Invite';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IMailer, MAILER } from '@infrastructure/mail/abstraction/IMailer';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { IInviteQueries, INVITE_QUERIES } from '@infrastructure/queries/abstraction/IInviteQueries';
import {
  IInviteRepository,
  INVITE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IInviteRepository';
import {
  IOrganizationRepository,
  ORGANIZATION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IOrganizationRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import { requirePlatform } from '@application/common/Authorization';
import { emailConflict, slugConflict } from '@application/common/Conflicts';

import { InviteResponse } from '../getinvites/InviteResponse';
import { inviteMail } from '../../InviteMail';
import { IssueInviteCommand } from './IssueInviteCommand';

export const APP_BASE_URL_DEFAULT = 'http://localhost:3200';

@CommandHandler(IssueInviteCommand)
export class IssueInviteCommandHandler implements ICommandHandler<
  IssueInviteCommand,
  InviteResponse
> {
  constructor(
    @Inject(INVITE_REPOSITORY) private readonly invites: IInviteRepository,
    @Inject(INVITE_QUERIES) private readonly inviteQueries: IInviteQueries,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: IOrganizationRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(MAILER) private readonly mailer: IMailer,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly config: ConfigService,
  ) {}

  async execute(command: IssueInviteCommand): Promise<InviteResponse> {
    const { actor } = command;
    requirePlatform(actor);
    const token = newSecureToken();
    const invite = Invite.issue({
      ...command.invite,
      tokenHash: hashToken(token),
      invitedBy: actor.userId,
    });

    if (
      (await this.organizations.slugExists(invite.slug)) ||
      (await this.invites.livePendingSlugExists(invite.slug))
    ) {
      throw slugConflict();
    }
    if (await this.users.emailExists(invite.email)) throw emailConflict();
    if (await this.invites.livePendingEmailExists(invite.email)) {
      throw new ConflictError('INVITE_PENDING', 'This email already has a pending invite.');
    }

    const appBaseUrl = this.config.get<string>('APP_BASE_URL', APP_BASE_URL_DEFAULT);
    const saved = await this.unitOfWork.run(async (tx) => {
      const created = await this.invites.save(invite, tx);
      await this.mailer.send(inviteMail(created, token, appBaseUrl), tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'invite.issued',
          entityType: 'invite',
          entityId: created.id,
          organizationId: null,
          newValues: {
            email: created.email,
            organizationName: created.organizationName,
            slug: created.slug,
          },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return created;
    });
    return InviteResponse.from((await this.inviteQueries.findById(saved.id as string))!);
  }
}
