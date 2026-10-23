import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { IRbacQueries, RBAC_QUERIES } from '@infrastructure/queries/abstraction/IRbacQueries';
import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import { assertHoldsAll, requirePermission, viewerOf } from '@application/common/Authorization';

import { assertKnownCodes } from '../../../rbac/RoleRules';
import { UserPermissionsResponse } from '../getuserpermissions/UserPermissionsResponse';
import { assertCanManage, forbiddenOperation, userNotFound } from '../../TenantUserRules';
import { SetUserPermissionsCommand } from './SetUserPermissionsCommand';

/** Makes `permissions` the user's effective set: grants = desired − roles, revokes = roles − desired. */
@CommandHandler(SetUserPermissionsCommand)
export class SetUserPermissionsCommandHandler implements ICommandHandler<
  SetUserPermissionsCommand,
  UserPermissionsResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(RBAC_QUERIES) private readonly rbac: IRbacQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: SetUserPermissionsCommand): Promise<UserPermissionsResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'users.edit');
    const target = await this.tenantUsers.findById(organizationId, command.id, viewerOf(actor));
    if (!target) throw userNotFound();
    assertCanManage(actor, target);
    if (target.id === actor.userId) {
      throw forbiddenOperation('You cannot change your own permissions.');
    }
    const desired = [...new Set(command.permissions)].sort();
    assertKnownCodes(desired, await this.rbac.allCodes());
    assertHoldsAll(actor, desired);

    const before = await this.tenantUsers.findPermissionBreakdown(target.id);
    const grants = desired.filter((code) => !before.rolePermissions.includes(code));
    const revokes = before.rolePermissions.filter((code) => !desired.includes(code));
    await this.unitOfWork.run(async (tx) => {
      await this.users.replacePermissionOverrides(target.id, grants, revokes, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'user.permissions_updated',
          entityType: 'user',
          entityId: target.id,
          organizationId,
          oldValues: { granted: before.granted, revoked: before.revoked },
          newValues: { granted: grants, revoked: revokes },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return UserPermissionsResponse.from(await this.tenantUsers.findPermissionBreakdown(target.id));
  }
}
