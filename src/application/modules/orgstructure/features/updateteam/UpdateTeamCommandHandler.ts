import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IOrgStructureQueries,
  ORG_STRUCTURE_QUERIES,
} from '@infrastructure/queries/abstraction/IOrgStructureQueries';
import {
  DEPARTMENT_REPOSITORY,
  IDepartmentRepository,
} from '@infrastructure/repositories/abstraction/IDepartmentRepository';
import {
  ITeamRepository,
  TEAM_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ITeamRepository';

import { requirePermission } from '@application/common/Authorization';

import { TeamResponse } from '../getteams/TeamResponse';
import { findManagedTeam, teamNameConflict } from '../../OrgScope';
import { UpdateTeamCommand } from './UpdateTeamCommand';

@CommandHandler(UpdateTeamCommand)
export class UpdateTeamCommandHandler implements ICommandHandler<UpdateTeamCommand, TeamResponse> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    @Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateTeamCommand): Promise<TeamResponse> {
    const { actor, changes } = command;
    const organizationId = requirePermission(actor, 'teams.edit');
    const team = await findManagedTeam(
      actor,
      organizationId,
      command.id,
      this.teams,
      this.departments,
    );
    const before = team.name;
    if (changes.name !== undefined) {
      team.rename(changes.name);
      if (await this.teams.activeNameExists(team.departmentId, team.nameKey, command.id)) {
        throw teamNameConflict();
      }
    }

    await this.unitOfWork.run(async (tx) => {
      await this.teams.update(team, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'team.updated',
          entityType: 'team',
          entityId: command.id,
          organizationId,
          oldValues: { name: before },
          newValues: { name: team.name },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return TeamResponse.from((await this.org.findTeam(organizationId, command.id))!);
  }
}
