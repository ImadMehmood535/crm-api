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

import { UpdateProjectRequest } from '../createproject/ProjectRequest';
import { ProjectResponse } from '../getproject/ProjectResponse';
import { projectNameConflict, projectNotFound } from '../../ProjectRules';
import { UpdateProjectCommand } from './UpdateProjectCommand';

/** PATCH: undefined = unchanged, null = cleared (currency and status cannot be cleared). */
function apply(project: Project, changes: UpdateProjectRequest): void {
  if (changes.name !== undefined) project.rename(changes.name);
  if (changes.description !== undefined) project.describe(changes.description);
  if (changes.city !== undefined || changes.address !== undefined) {
    project.relocate(
      changes.city !== undefined ? changes.city : project.city,
      changes.address !== undefined ? changes.address : project.address,
    );
  }
  if (changes.currency !== undefined && changes.currency !== null)
    project.setCurrency(changes.currency);
  if (changes.status !== undefined && changes.status !== null) project.changeStatus(changes.status);
  if (changes.expectedCompletion !== undefined)
    project.scheduleCompletion(changes.expectedCompletion);
}

@CommandHandler(UpdateProjectCommand)
export class UpdateProjectCommandHandler implements ICommandHandler<
  UpdateProjectCommand,
  ProjectResponse
> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    @Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<ProjectResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'projects.edit');
    const project = await this.projects.findById(organizationId, command.id);
    if (!project) throw projectNotFound();
    const before = { name: project.name, status: project.status };
    apply(project, command.changes);
    if (await this.projects.nameKeyExists(organizationId, project.nameKey, command.id))
      throw projectNameConflict();

    await this.unitOfWork.run(async (tx) => {
      await this.projects.update(project, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'project.updated',
          entityType: 'project',
          entityId: command.id,
          organizationId,
          oldValues: before,
          newValues: { name: project.name, status: project.status },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return ProjectResponse.from((await this.inventory.findProject(organizationId, command.id))!);
  }
}
