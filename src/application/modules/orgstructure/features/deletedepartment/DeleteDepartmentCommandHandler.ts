import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ConflictError } from '@shared/errors/AppError';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  DEPARTMENT_REPOSITORY,
  IDepartmentRepository,
} from '@infrastructure/repositories/abstraction/IDepartmentRepository';

import { requirePermission } from '@application/common/Authorization';

import { assertCanManageDepartments, departmentNotFound } from '../../OrgScope';
import { DeleteDepartmentCommand } from './DeleteDepartmentCommand';

/** Departments are deactivated, never deleted. */
@CommandHandler(DeleteDepartmentCommand)
export class DeleteDepartmentCommandHandler implements ICommandHandler<
  DeleteDepartmentCommand,
  null
> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: DeleteDepartmentCommand): Promise<null> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'departments.delete');
    assertCanManageDepartments(actor);
    const department = await this.departments.findById(organizationId, command.id);
    if (!department) throw departmentNotFound();
    if (await this.departments.hasActiveTeams(command.id)) {
      throw new ConflictError('DEPARTMENT_HAS_TEAMS', "Deactivate this department's teams first.");
    }

    department.deactivate();
    await this.unitOfWork.run(async (tx) => {
      await this.departments.update(department, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'department.deactivated',
          entityType: 'department',
          entityId: command.id,
          organizationId,
          oldValues: { name: department.name },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return null;
  }
}
