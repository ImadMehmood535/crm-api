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
import { findManagedTeam } from '../../OrgScope';
import { RemoveTeamMemberCommand } from './RemoveTeamMemberCommand';

@CommandHandler(RemoveTeamMemberCommand)
export class RemoveTeamMemberCommandHandler implements ICommandHandler<
  RemoveTeamMemberCommand,
  TeamResponse
> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    @Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: RemoveTeamMemberCommand): Promise<TeamResponse> {
    const { actor, teamId, userId } = command;
    const organizationId = requirePermission(actor, 'teams.edit');
    await findManagedTeam(actor, organizationId, teamId, this.teams, this.departments);

    await this.unitOfWork.run(async (tx) => {
      await this.teams.removeMember(teamId, userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'team.member_removed',
          entityType: 'team',
          entityId: teamId,
          organizationId,
          oldValues: { userId },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return TeamResponse.from((await this.org.findTeam(organizationId, teamId))!);
  }
}
