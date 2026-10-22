import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  DEVELOPER_QUERIES,
  IDeveloperQueries,
} from '@infrastructure/queries/abstraction/IDeveloperQueries';
import {
  IOrganizationRepository,
  ORGANIZATION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IOrganizationRepository';
import { requirePlatform } from '@application/common/Authorization';

import { DeveloperResponse } from '../getdeveloper/DeveloperResponse';
import { developerNotFound } from '../getdeveloper/GetDeveloperQueryHandler';
import { ChangeDeveloperStatusCommand } from './ChangeDeveloperStatusCommand';

/**
 * Suspend / reactivate. Idempotent: repeating it changes nothing and records nothing. Suspension
 * takes effect on each user's next request (the auth guard re-checks the company every time).
 */
@CommandHandler(ChangeDeveloperStatusCommand)
export class ChangeDeveloperStatusCommandHandler implements ICommandHandler<
  ChangeDeveloperStatusCommand,
  DeveloperResponse
> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: IOrganizationRepository,
    @Inject(DEVELOPER_QUERIES) private readonly developers: IDeveloperQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: ChangeDeveloperStatusCommand): Promise<DeveloperResponse> {
    requirePlatform(command.actor);
    const organization = await this.organizations.findById(command.id);
    if (!organization) throw developerNotFound();

    const before = organization.status;
    const changed =
      command.change === 'suspend' ? organization.suspend() : organization.reactivate();
    if (changed) {
      await this.unitOfWork.run(async (tx) => {
        await this.organizations.update(organization, tx);
        await this.audit.record(
          {
            actorUserId: command.actor.userId,
            action: command.change === 'suspend' ? 'developer.suspended' : 'developer.reactivated',
            entityType: 'organization',
            entityId: command.id,
            organizationId: command.id,
            oldValues: { status: before },
            newValues: { status: organization.status },
            ip: command.meta.ipAddress,
          },
          tx,
        );
      });
    }
    return DeveloperResponse.from((await this.developers.findById(command.id))!);
  }
}
