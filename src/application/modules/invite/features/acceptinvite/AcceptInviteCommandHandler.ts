import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ROLE_LEVELS } from '@shared/auth/LevelRoles';
import { UnauthenticatedError } from '@shared/errors/AppError';
import { hashToken } from '@shared/utils/SecureToken';
import { inviteInvalid } from '@domain/aggregates/InviteAggregate/Invite';
import { Organization } from '@domain/aggregates/OrganizationAggregate/Organization';
import { User } from '@domain/aggregates/UserAggregate/User';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { AUTH_QUERIES, IAuthQueries } from '@infrastructure/queries/abstraction/IAuthQueries';
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
import { emailConflict, slugConflict } from '@application/common/Conflicts';
import { AuthSessionResponse } from '@application/modules/auth/features/login/AuthSessionResponse';
import { SessionIssuer } from '@application/modules/auth/SessionIssuer';

import { AcceptInviteCommand } from './AcceptInviteCommand';

/** Public. Creates the company and its owner from a live invite, then signs the owner in. */
@CommandHandler(AcceptInviteCommand)
export class AcceptInviteCommandHandler implements ICommandHandler<
  AcceptInviteCommand,
  AuthSessionResponse
> {
  constructor(
    @Inject(INVITE_REPOSITORY) private readonly invites: IInviteRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: IOrganizationRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(AUTH_QUERIES) private readonly authQueries: IAuthQueries,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: AcceptInviteCommand): Promise<AuthSessionResponse> {
    const { body } = command;
    const passwordHash = await this.hasher.hash(body.password);

    const ownerId = await this.unitOfWork.run(async (tx) => {
      const invite = await this.invites.findByTokenHash(hashToken(command.token), tx);
      if (!invite) throw inviteInvalid();
      invite.accept();
      if (await this.organizations.slugExists(invite.slug)) throw slugConflict();
      if (await this.users.emailExists(invite.email)) throw emailConflict();

      const organization = await this.organizations.save(
        Organization.create({
          name: body.organizationName ?? invite.organizationName,
          slug: invite.slug,
          createdBy: null,
        }),
        tx,
      );
      const organizationId = organization.id as string;
      const roleId = await this.roles.createOwnerRole(organizationId, tx);
      for (const level of ROLE_LEVELS) await this.roles.levelRoleId(organizationId, level, tx);
      const owner = await this.users.save(
        User.createTenantUser(organizationId, {
          email: invite.email,
          firstName: body.firstName ?? invite.firstName,
          lastName: body.lastName ?? invite.lastName,
          createdBy: null,
          level: 'owner',
        }),
        passwordHash,
        false,
        tx,
      );
      await this.users.assignRole(owner.id as string, roleId, null, tx);
      await this.invites.update(invite, tx);
      await this.audit.record(
        {
          actorUserId: null,
          action: 'invite.accepted',
          entityType: 'invite',
          entityId: invite.id,
          organizationId,
          newValues: {
            organizationName: organization.name,
            slug: organization.slug,
            ownerEmail: invite.email,
          },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return owner.id as string;
    });

    const account = await this.authQueries.findAccount(ownerId);
    if (!account) throw new UnauthenticatedError();
    // Accepting signs the new owner in, so it counts as their first sign-in.
    await this.users.markLoggedIn(ownerId);
    return this.sessionIssuer.start(account.user, command.meta);
  }
}
