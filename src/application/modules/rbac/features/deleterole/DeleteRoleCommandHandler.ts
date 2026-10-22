import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ConflictError } from '@shared/errors/AppError';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IRoleRepository';
import { assertHoldsAll, requirePermission } from '@application/common/Authorization';

import { roleNotFound } from '../../RoleRules';
import { DeleteRoleCommand } from './DeleteRoleCommand';

/**
 * DELETE /roles/{id}. Roles are deactivated, never deleted (decision 13): the role leaves every list
 * and can no longer be assigned, while history (audit, grants) keeps referring to it.
 */
@CommandHandler(DeleteRoleCommand)
export class DeleteRoleCommandHandler implements ICommandHandler<DeleteRoleCommand, null> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: DeleteRoleCommand): Promise<null> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'roles.delete');
    const role = await this.roles.findTenantRole(organizationId, command.id);
    if (!role?.isActive) throw roleNotFound();
    role.assertEditable();
    assertHoldsAll(
      actor,
      role.permissions,
      'You cannot delete a role that holds permissions you do not have.',
    );
    const holders = await this.roles.countHolders(command.id);
    if (holders > 0) {
      throw new ConflictError(
        'ROLE_IN_USE',
        `This role is assigned to ${holders} user${holders === 1 ? '' : 's'}; reassign them first.`,
      );
    }

    role.deactivate();
    await this.unitOfWork.run(async (tx) => {
      await this.roles.updateTenantRole(role, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.deactivated',
          entityType: 'role',
          entityId: command.id,
          organizationId,
          oldValues: { isActive: true },
          newValues: { isActive: false },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return null;
  }
}
