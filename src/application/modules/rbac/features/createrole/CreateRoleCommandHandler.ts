import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { Role } from '@domain/aggregates/RoleAggregate/Role';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { IRbacQueries, RBAC_QUERIES } from '@infrastructure/queries/abstraction/IRbacQueries';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IRoleRepository';
import { assertHoldsAll, requirePermission } from '@application/common/Authorization';

import { RoleResponse } from '../getroles/RoleResponse';
import { assertKnownCodes, roleNameConflict } from '../../RoleRules';
import { CreateRoleCommand } from './CreateRoleCommand';

@CommandHandler(CreateRoleCommand)
export class CreateRoleCommandHandler implements ICommandHandler<CreateRoleCommand, RoleResponse> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(RBAC_QUERIES) private readonly rbac: IRbacQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateRoleCommand): Promise<RoleResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'roles.create');
    const role = Role.create({
      organizationId,
      name: command.role.name,
      description: command.role.description ?? null,
      permissions: command.role.permissions,
    });
    assertKnownCodes(role.permissions, await this.rbac.allCodes());
    assertHoldsAll(actor, role.permissions);
    if (await this.roles.activeCodeExists(organizationId, role.code)) throw roleNameConflict();

    const saved = await this.unitOfWork.run(async (tx) => {
      const created = await this.roles.saveTenantRole(role, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.created',
          entityType: 'role',
          entityId: created.id,
          organizationId,
          newValues: { name: created.name, permissions: [...created.permissions] },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return created;
    });
    return RoleResponse.from((await this.rbac.findRole(organizationId, saved.id as string))!);
  }
}
