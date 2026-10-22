import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ConflictError } from '@shared/errors/AppError';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  DEPARTMENT_REPOSITORY,
  IDepartmentRepository,
} from '@infrastructure/repositories/abstraction/IDepartmentRepository';
import {
  ITeamRepository,
  TEAM_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ITeamRepository';

import { requirePermission } from '@application/common/Authorization';

import { findManagedTeam } from '../../OrgScope';
import { DeleteTeamCommand } from './DeleteTeamCommand';

/** Teams are deactivated, never deleted. */
@CommandHandler(DeleteTeamCommand)
export class DeleteTeamCommandHandler implements ICommandHandler<DeleteTeamCommand, null> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: DeleteTeamCommand): Promise<null> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'teams.delete');
    const team = await findManagedTeam(
      actor,
      organizationId,
      command.id,
      this.teams,
      this.departments,
    );
    if (await this.teams.hasMembers(command.id)) {
      throw new ConflictError('TEAM_HAS_MEMBERS', 'Remove the members of this team first.');
    }

    team.deactivate();
    await this.unitOfWork.run(async (tx) => {
      await this.teams.update(team, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'team.deactivated',
          entityType: 'team',
          entityId: command.id,
          organizationId,
          oldValues: { name: team.name },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return null;
  }
}
