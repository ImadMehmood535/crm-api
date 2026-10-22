import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ConflictError } from '@shared/errors/AppError';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IProjectRepository';
import { requirePermission } from '@application/common/Authorization';

import { projectNotFound } from '../../ProjectRules';
import { DeleteProjectCommand } from './DeleteProjectCommand';

@CommandHandler(DeleteProjectCommand)
export class DeleteProjectCommandHandler implements ICommandHandler<DeleteProjectCommand, null> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: DeleteProjectCommand): Promise<null> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'projects.delete');
    const project = await this.projects.findById(organizationId, command.id);
    if (!project) throw projectNotFound();
    if (await this.projects.hasUnits(command.id)) {
      throw new ConflictError('PROJECT_HAS_UNITS', "Delete or move this project's units first.");
    }

    await this.unitOfWork.run(async (tx) => {
      await this.projects.delete(command.id, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'project.deleted',
          entityType: 'project',
          entityId: command.id,
          organizationId,
          oldValues: { name: project.name },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return null;
  }
}
