import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { assertCanCreateLevel } from '@domain/aggregates/UserAggregate/UserLevel';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IRoleRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import { companyViewer, requirePermission, viewerOf } from '@application/common/Authorization';

import { TenantUserResponse } from '../gettenantuser/TenantUserResponse';
import {
  assertAssignable,
  assertCanManage,
  forbiddenOperation,
  userNotFound,
} from '../../TenantUserRules';
import { UpdateTenantUserCommand } from './UpdateTenantUserCommand';

@CommandHandler(UpdateTenantUserCommand)
export class UpdateTenantUserCommandHandler implements ICommandHandler<
  UpdateTenantUserCommand,
  TenantUserResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateTenantUserCommand): Promise<TenantUserResponse> {
    const { actor, changes } = command;
    const organizationId = requirePermission(actor, 'users.edit');
    const target = await this.tenantUsers.findById(organizationId, command.id, viewerOf(actor));
    const user = target ? await this.users.findTenantUser(organizationId, command.id) : null;
    if (!target || !user) throw userNotFound();
    assertCanManage(actor, target);
    if (changes.roleIds !== undefined && command.id === actor.userId) {
      throw forbiddenOperation('You cannot change your own roles.');
    }

    if (changes.firstName !== undefined || changes.lastName !== undefined) {
      user.rename(changes.firstName ?? user.firstName, changes.lastName ?? user.lastName);
    }
    if (changes.level !== undefined && changes.level !== target.level) {
      const actorLevel = viewerOf(actor).level;
      assertCanCreateLevel(actorLevel, target.level);
      assertCanCreateLevel(actorLevel, changes.level);
      user.changeLevel(changes.level);
    }
    const roleIds = changes.roleIds ? [...new Set(changes.roleIds)] : undefined;
    if (roleIds)
      assertAssignable(
        actor,
        roleIds,
        await this.roles.findActiveTenantRoles(organizationId, roleIds),
      );

    await this.unitOfWork.run(async (tx) => {
      await this.users.update(user, tx);
      if (roleIds) await this.users.replaceRoles(command.id, roleIds, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'user.updated',
          entityType: 'user',
          entityId: command.id,
          organizationId,
          oldValues: {
            firstName: target.firstName,
            lastName: target.lastName,
            level: target.level,
            roleIds: target.roles.map((r) => r.id),
          },
          newValues: {
            firstName: user.firstName,
            lastName: user.lastName,
            level: user.level,
            roleIds: roleIds ?? target.roles.map((r) => r.id),
          },
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
