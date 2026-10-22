import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ValidationFailedError } from '@shared/errors/AppError';
import { Team } from '@domain/aggregates/TeamAggregate/Team';
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
import { assertCanManageTeamsOf, teamNameConflict } from '../../OrgScope';
import { CreateTeamCommand } from './CreateTeamCommand';

@CommandHandler(CreateTeamCommand)
export class CreateTeamCommandHandler implements ICommandHandler<CreateTeamCommand, TeamResponse> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    @Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateTeamCommand): Promise<TeamResponse> {
    const { actor, team: input } = command;
    const organizationId = requirePermission(actor, 'teams.create');
    const department = await this.departments.findById(organizationId, input.departmentId);
    if (!department) throw ValidationFailedError.forField('departmentId', 'Choose a department.');
    assertCanManageTeamsOf(actor, department);
    const team = Team.create(organizationId, input.departmentId, input.name, actor.userId);
    if (await this.teams.activeNameExists(input.departmentId, team.nameKey))
      throw teamNameConflict();

    const id = await this.unitOfWork.run(async (tx) => {
      const saved = await this.teams.save(team, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'team.created',
          entityType: 'team',
          entityId: saved.id,
          organizationId,
          newValues: { name: saved.name, departmentId: saved.departmentId },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return saved.id as string;
    });
    return TeamResponse.from((await this.org.findTeam(organizationId, id))!);
  }
}
