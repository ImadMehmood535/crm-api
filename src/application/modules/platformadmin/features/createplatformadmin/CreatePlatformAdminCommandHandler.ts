import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { newTemporaryPassword } from '@shared/utils/TemporaryPassword';
import { User } from '@domain/aggregates/UserAggregate/User';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IPlatformAdminQueries,
  PLATFORM_ADMIN_QUERIES,
} from '@infrastructure/queries/abstraction/IPlatformAdminQueries';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IRoleRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@infrastructure/security/abstraction/IPasswordHasher';
import { requirePlatformSuperUser } from '@application/common/Authorization';
import { emailConflict } from '@application/common/Conflicts';

import { PlatformAdminResponse } from '../getplatformadmins/PlatformAdminResponse';
import { CreatePlatformAdminCommand } from './CreatePlatformAdminCommand';
import { CreatePlatformAdminResponse } from './CreatePlatformAdminResponse';

const PLATFORM_ADMIN_ROLE = 'platform_admin';

@CommandHandler(CreatePlatformAdminCommand)
export class CreatePlatformAdminCommandHandler implements ICommandHandler<
  CreatePlatformAdminCommand,
  CreatePlatformAdminResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(PLATFORM_ADMIN_QUERIES) private readonly admins: IPlatformAdminQueries,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreatePlatformAdminCommand): Promise<CreatePlatformAdminResponse> {
    const { actor } = command;
    requirePlatformSuperUser(actor);
    const admin = User.createPlatformAdmin({ ...command.admin, createdBy: actor.userId });
    if (await this.users.emailExists(admin.email)) throw emailConflict();
    const roleId = await this.roles.findPlatformRoleId(PLATFORM_ADMIN_ROLE);
    if (!roleId) throw new Error('Platform roles are not seeded (run npm run db:seed).');

    const temporaryPassword = newTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    const adminId = await this.unitOfWork.run(async (tx) => {
      const saved = await this.users.save(admin, passwordHash, true, tx);
      const id = saved.id as string;
      await this.users.assignRole(id, roleId, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'platform_admin.created',
          entityType: 'user',
          entityId: id,
          organizationId: null,
          newValues: { email: saved.email, role: PLATFORM_ADMIN_ROLE },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return id;
    });
    return CreatePlatformAdminResponse.of(
      PlatformAdminResponse.from((await this.admins.findById(adminId))!),
      temporaryPassword,
    );
  }
}
