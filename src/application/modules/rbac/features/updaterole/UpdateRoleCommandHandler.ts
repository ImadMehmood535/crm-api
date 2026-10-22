import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { IRbacQueries, RBAC_QUERIES } from '@infrastructure/queries/abstraction/IRbacQueries';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IRoleRepository';
import { assertHoldsAll, requirePermission } from '@application/common/Authorization';

import { RoleResponse } from '../getroles/RoleResponse';
import { assertKnownCodes, roleNameConflict, roleNotFound } from '../../RoleRules';
import { UpdateRoleCommand } from './UpdateRoleCommand';

@CommandHandler(UpdateRoleCommand)
export class UpdateRoleCommandHandler implements ICommandHandler<UpdateRoleCommand, RoleResponse> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(RBAC_QUERIES) private readonly rbac: IRbacQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateRoleCommand): Promise<RoleResponse> {
    const { actor, changes } = command;
    const organizationId = requirePermission(actor, 'roles.edit');
    const role = await this.roles.findTenantRole(organizationId, command.id);
    if (!role?.isActive) throw roleNotFound();
    role.assertEditable();
    const before = { name: role.name, permissions: [...role.permissions] };

    if (changes.name !== undefined) role.rename(changes.name);
    if (changes.description !== undefined) role.describe(changes.description);
    if (changes.permissions !== undefined) {
      assertKnownCodes(changes.permissions, await this.rbac.allCodes());
    }
    assertHoldsAll(
      actor,
      before.permissions,
      'You cannot edit a role that holds permissions you do not have.',
    );
    if (changes.permissions !== undefined) {
      role.grant(changes.permissions);
      assertHoldsAll(actor, role.permissions);
    }
    if (await this.roles.activeCodeExists(organizationId, role.code, command.id))
      throw roleNameConflict();

    await this.unitOfWork.run(async (tx) => {
      await this.roles.updateTenantRole(role, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.updated',
          entityType: 'role',
          entityId: command.id,
          organizationId,
          oldValues: before,
          newValues: { name: role.name, permissions: [...role.permissions] },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return RoleResponse.from((await this.rbac.findRole(organizationId, command.id))!);
  }
}
