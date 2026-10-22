import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import { companyViewer, requirePermission, viewerOf } from '@application/common/Authorization';

import { TenantUserResponse } from '../gettenantuser/TenantUserResponse';
import { assertCanManage, forbiddenOperation, userNotFound } from '../../TenantUserRules';
import { ChangeTenantUserStatusCommand } from './ChangeTenantUserStatusCommand';

/** Activate / deactivate. Deactivation ends the user's sessions at once. */
@CommandHandler(ChangeTenantUserStatusCommand)
export class ChangeTenantUserStatusCommandHandler implements ICommandHandler<
  ChangeTenantUserStatusCommand,
  TenantUserResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: ChangeTenantUserStatusCommand): Promise<TenantUserResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'users.deactivate');
    const target = await this.tenantUsers.findById(organizationId, command.id, viewerOf(actor));
    const user = target ? await this.users.findTenantUser(organizationId, command.id) : null;
    if (!target || !user) throw userNotFound();
    const deactivating = command.change === 'deactivate';
    if (deactivating && command.id === actor.userId) {
      throw forbiddenOperation('You cannot deactivate your own account.');
    }
    assertCanManage(actor, target);

    if (deactivating) user.deactivate();
    else user.activate();
    await this.unitOfWork.run(async (tx) => {
      await this.users.update(user, tx);
      if (deactivating) await this.sessions.revokeAllForUser(command.id, 'account_deactivated', tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: deactivating ? 'user.deactivated' : 'user.activated',
          entityType: 'user',
          entityId: command.id,
          organizationId,
          oldValues: { status: target.status },
          newValues: { status: user.status },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return TenantUserResponse.from(
      (await this.tenantUsers.findById(organizationId, command.id, companyViewer(actor)))!,
    );
  }
}
