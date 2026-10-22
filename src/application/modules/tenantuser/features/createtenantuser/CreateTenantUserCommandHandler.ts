import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { newTemporaryPassword } from '@shared/utils/TemporaryPassword';
import { User } from '@domain/aggregates/UserAggregate/User';
import { assertCanCreateLevel } from '@domain/aggregates/UserAggregate/UserLevel';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import {
  DEPARTMENT_REPOSITORY,
  IDepartmentRepository,
} from '@infrastructure/repositories/abstraction/IDepartmentRepository';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IRoleRepository';
import {
  ITeamRepository,
  TEAM_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ITeamRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@infrastructure/security/abstraction/IPasswordHasher';
import { companyViewer, requirePermission, viewerOf } from '@application/common/Authorization';
import { emailConflict } from '@application/common/Conflicts';

import { assertManageableTeams } from '../../../orgstructure/OrgScope';
import { TenantUserWithPasswordResponse } from '../gettenantuser/TenantUserResponse';
import { assertAssignable } from '../../TenantUserRules';
import { CreateTenantUserCommand } from './CreateTenantUserCommand';

/** A staff account with roles and a one-time temporary password (must reset at first login). */
@CommandHandler(CreateTenantUserCommand)
export class CreateTenantUserCommandHandler implements ICommandHandler<
  CreateTenantUserCommand,
  TenantUserWithPasswordResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    @Inject(DEPARTMENT_REPOSITORY) private readonly departments: IDepartmentRepository,
    @Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateTenantUserCommand): Promise<TenantUserWithPasswordResponse> {
    const { actor, user: input } = command;
    const organizationId = requirePermission(actor, 'users.create');
    const level = input.level ?? 'member';
    assertCanCreateLevel(viewerOf(actor).level, level);
    const user = User.createTenantUser(organizationId, {
      ...input,
      level,
      createdBy: actor.userId,
    });
    const roleIds = [...new Set(input.roleIds)];
    assertAssignable(
      actor,
      roleIds,
      await this.roles.findActiveTenantRoles(organizationId, roleIds),
    );
    const teamIds = [...new Set(input.teamIds ?? [])];
    await assertManageableTeams(actor, organizationId, teamIds, this.teams, this.departments);
    if (await this.users.emailExists(user.email)) throw emailConflict();

    const temporaryPassword = newTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    const userId = await this.unitOfWork.run(async (tx) => {
      const saved = await this.users.save(user, passwordHash, true, tx);
      const id = saved.id as string;
      await this.users.replaceRoles(id, roleIds, actor.userId, tx);
      for (const teamId of teamIds) await this.teams.addMember(teamId, id, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'user.created',
          entityType: 'user',
          entityId: id,
          organizationId,
          newValues: { email: saved.email, roleIds, level, teamIds },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return id;
    });
    return TenantUserWithPasswordResponse.of(
      (await this.tenantUsers.findById(organizationId, userId, companyViewer(actor)))!,
      temporaryPassword,
    );
  }
}
