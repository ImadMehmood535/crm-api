import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { newTemporaryPassword } from '@shared/utils/TemporaryPassword';
import { Organization } from '@domain/aggregates/OrganizationAggregate/Organization';
import { User, normalizeEmail } from '@domain/aggregates/UserAggregate/User';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  DEVELOPER_QUERIES,
  IDeveloperQueries,
} from '@infrastructure/queries/abstraction/IDeveloperQueries';
import {
  IInviteRepository,
  INVITE_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IInviteRepository';
import {
  IOrganizationRepository,
  ORGANIZATION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IOrganizationRepository';
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
import { requirePlatform } from '@application/common/Authorization';
import { emailConflict, slugConflict } from '@application/common/Conflicts';

import { DeveloperResponse } from '../getdeveloper/DeveloperResponse';
import { OnboardDeveloperCommand } from './OnboardDeveloperCommand';
import { OnboardDeveloperResponse } from './OnboardDeveloperResponse';

/** Company + its owner role + its owner (temporary password, must reset), all or nothing. */
@CommandHandler(OnboardDeveloperCommand)
export class OnboardDeveloperCommandHandler implements ICommandHandler<
  OnboardDeveloperCommand,
  OnboardDeveloperResponse
> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: IOrganizationRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(INVITE_REPOSITORY) private readonly invites: IInviteRepository,
    @Inject(DEVELOPER_QUERIES) private readonly developers: IDeveloperQueries,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: OnboardDeveloperCommand): Promise<OnboardDeveloperResponse> {
    const { actor } = command;
    requirePlatform(actor);
    const organization = Organization.create({
      name: command.name,
      slug: command.slug,
      createdBy: actor.userId,
    });
    const email = normalizeEmail(command.owner.email, 'superUser.email');
    if (
      (await this.organizations.slugExists(organization.slug)) ||
      (await this.invites.livePendingSlugExists(organization.slug))
    ) {
      throw slugConflict();
    }
    if (await this.users.emailExists(email)) throw emailConflict();

    const temporaryPassword = newTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    const { organizationId, ownerId } = await this.unitOfWork.run(async (tx) => {
      const saved = await this.organizations.save(organization, tx);
      const id = saved.id as string;
      const roleId = await this.roles.createOwnerRole(id, tx);
      const owner = await this.users.save(
        User.createTenantUser(id, { ...command.owner, email, createdBy: actor.userId }),
        passwordHash,
        true,
        tx,
      );
      await this.users.assignRole(owner.id as string, roleId, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'developer.onboarded',
          entityType: 'organization',
          entityId: id,
          organizationId: id,
          newValues: { name: saved.name, slug: saved.slug, ownerEmail: email },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return { organizationId: id, ownerId: owner.id as string };
    });

    const developer = (await this.developers.findById(organizationId))!;
    return OnboardDeveloperResponse.of(
      DeveloperResponse.from(developer),
      { id: ownerId, email },
      temporaryPassword,
    );
  }
}
