import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IOrgStructureQueries,
  ORG_STRUCTURE_QUERIES,
} from '@infrastructure/queries/abstraction/IOrgStructureQueries';
import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import {
  DEPARTMENT_REPOSITORY,
  IDepartmentRepository,
} from '@infrastructure/repositories/abstraction/IDepartmentRepository';

import { requirePermission, viewerOf } from '@application/common/Authorization';

import { DepartmentResponse } from '../getdepartments/DepartmentResponse';
import {
  assertCanManageDepartments,
  assertHeadCandidate,
  departmentNameConflict,
  departmentNotFound,
} from '../../OrgScope';
import { UpdateDepartmentCommand } from './UpdateDepartmentCommand';

@CommandHandler(UpdateDepartmentCommand)
export class UpdateDepartmentCommandHandler implements ICommandHandler<
  UpdateDepartmentCommand,
  DepartmentResponse
> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateDepartmentCommand): Promise<DepartmentResponse> {
    const { actor, changes } = command;
    const organizationId = requirePermission(actor, 'departments.edit');
    assertCanManageDepartments(actor);
    const department = await this.departments.findById(organizationId, command.id);
    if (!department) throw departmentNotFound();
    const before = { name: department.name, headUserId: department.headUserId };

    if (changes.name !== undefined) {
      department.rename(changes.name);
      if (await this.departments.activeNameExists(organizationId, department.nameKey, command.id)) {
        throw departmentNameConflict();
      }
    }
    if (changes.headUserId !== undefined) {
      if (changes.headUserId) {
        assertHeadCandidate(
          await this.tenantUsers.findById(organizationId, changes.headUserId, viewerOf(actor)),
        );
      }
      department.assignHead(changes.headUserId);
    }

    await this.unitOfWork.run(async (tx) => {
      await this.departments.update(department, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'department.updated',
          entityType: 'department',
          entityId: command.id,
          organizationId,
          oldValues: before,
          newValues: { name: department.name, headUserId: department.headUserId },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return DepartmentResponse.from((await this.org.findDepartment(organizationId, command.id))!);
  }
}
