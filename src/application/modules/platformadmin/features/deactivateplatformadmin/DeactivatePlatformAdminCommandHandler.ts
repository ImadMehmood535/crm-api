import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ConflictError, NotFoundError } from '@shared/errors/AppError';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IPlatformAdminQueries,
  PLATFORM_ADMIN_QUERIES,
} from '@infrastructure/queries/abstraction/IPlatformAdminQueries';
import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import { requirePlatformSuperUser } from '@application/common/Authorization';

import { PlatformAdminResponse } from '../getplatformadmins/PlatformAdminResponse';
import { DeactivatePlatformAdminCommand } from './DeactivatePlatformAdminCommand';

/** Never leaves the platform without an active super user. Sessions end at once. */
@CommandHandler(DeactivatePlatformAdminCommand)
export class DeactivatePlatformAdminCommandHandler implements ICommandHandler<
  DeactivatePlatformAdminCommand,
  PlatformAdminResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(PLATFORM_ADMIN_QUERIES) private readonly admins: IPlatformAdminQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: DeactivatePlatformAdminCommand): Promise<PlatformAdminResponse> {
    requirePlatformSuperUser(command.actor);
    const target = await this.admins.findById(command.id);
    const user = target ? await this.users.findById(command.id) : null;
    if (!target || !user) throw new NotFoundError('Admin not found.');
    if (
      target.role === 'platform_super_user' &&
      target.isActive &&
      (await this.users.countOtherActivePlatformSuperUsers(command.id)) === 0
    ) {
      throw new ConflictError(
        'LAST_SUPER_USER',
        'The last active platform super user cannot be deactivated.',
      );
    }

    user.deactivate();
    await this.unitOfWork.run(async (tx) => {
      await this.users.update(user, tx);
      await this.sessions.revokeAllForUser(command.id, 'account_deactivated', tx);
      await this.audit.record(
        {
          actorUserId: command.actor.userId,
          action: 'platform_admin.deactivated',
          entityType: 'user',
          entityId: command.id,
          organizationId: null,
          oldValues: { isActive: target.isActive },
          newValues: { isActive: false },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return PlatformAdminResponse.from((await this.admins.findById(command.id))!);
  }
}
