import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { Department } from '@domain/aggregates/DepartmentAggregate/Department';
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
} from '../../OrgScope';
import { CreateDepartmentCommand } from './CreateDepartmentCommand';

@CommandHandler(CreateDepartmentCommand)
export class CreateDepartmentCommandHandler implements ICommandHandler<
  CreateDepartmentCommand,
  DepartmentResponse
> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateDepartmentCommand): Promise<DepartmentResponse> {
    const { actor, department: input } = command;
    const organizationId = requirePermission(actor, 'departments.create');
    assertCanManageDepartments(actor);
    const headUserId = input.headUserId ?? null;
    if (headUserId) {
      assertHeadCandidate(
        await this.tenantUsers.findById(organizationId, headUserId, viewerOf(actor)),
      );
    }
    const department = Department.create(organizationId, input.name, headUserId, actor.userId);
    if (await this.departments.activeNameExists(organizationId, department.nameKey)) {
      throw departmentNameConflict();
    }

    const id = await this.unitOfWork.run(async (tx) => {
      const saved = await this.departments.save(department, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'department.created',
          entityType: 'department',
          entityId: saved.id,
          organizationId,
          newValues: { name: saved.name, headUserId },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return saved.id as string;
    });
    return DepartmentResponse.from((await this.org.findDepartment(organizationId, id))!);
  }
}
