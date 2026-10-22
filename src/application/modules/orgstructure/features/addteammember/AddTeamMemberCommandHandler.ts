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
import {
  ITeamRepository,
  TEAM_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ITeamRepository';

import { requirePermission, viewerOf } from '@application/common/Authorization';

import { TeamResponse } from '../getteams/TeamResponse';
import { assertMemberCandidate, findManagedTeam } from '../../OrgScope';
import { AddTeamMemberCommand } from './AddTeamMemberCommand';

/** A user may be in many teams; adding an existing member changes nothing. */
@CommandHandler(AddTeamMemberCommand)
export class AddTeamMemberCommandHandler implements ICommandHandler<
  AddTeamMemberCommand,
  TeamResponse
> {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: AddTeamMemberCommand): Promise<TeamResponse> {
    const { actor, teamId, userId } = command;
    const organizationId = requirePermission(actor, 'teams.edit');
    await findManagedTeam(actor, organizationId, teamId, this.teams, this.departments);
    assertMemberCandidate(await this.tenantUsers.findById(organizationId, userId, viewerOf(actor)));

    await this.unitOfWork.run(async (tx) => {
      await this.teams.addMember(teamId, userId, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'team.member_added',
          entityType: 'team',
          entityId: teamId,
          organizationId,
          newValues: { userId },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return TeamResponse.from((await this.org.findTeam(organizationId, teamId))!);
  }
}
