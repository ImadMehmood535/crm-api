import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { Project } from '@domain/aggregates/ProjectAggregate/Project';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IInventoryQueries,
  INVENTORY_QUERIES,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IProjectRepository';
import { requirePermission } from '@application/common/Authorization';

import { ProjectResponse } from '../getproject/ProjectResponse';
import { projectNameConflict } from '../../ProjectRules';
import { CreateProjectCommand } from './CreateProjectCommand';

@CommandHandler(CreateProjectCommand)
export class CreateProjectCommandHandler implements ICommandHandler<
  CreateProjectCommand,
  ProjectResponse
> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    @Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateProjectCommand): Promise<ProjectResponse> {
    const { actor, project: input } = command;
    const organizationId = requirePermission(actor, 'projects.create');
    const project = Project.create({
      organizationId,
      name: input.name,
      description: input.description ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      currency: input.currency ?? null,
      status: input.status ?? null,
      expectedCompletion: input.expectedCompletion ?? null,
      createdBy: actor.userId,
    });
    if (await this.projects.nameKeyExists(organizationId, project.nameKey))
      throw projectNameConflict();

    const saved = await this.unitOfWork.run(async (tx) => {
      const created = await this.projects.save(project, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'project.created',
          entityType: 'project',
          entityId: created.id,
          organizationId,
          newValues: { name: created.name, status: created.status },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return created;
    });
    return ProjectResponse.from(
      (await this.inventory.findProject(organizationId, saved.id as string))!,
    );
  }
}
