import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  BRANDING_QUERIES,
  IBrandingQueries,
} from '@infrastructure/queries/abstraction/IBrandingQueries';
import {
  BRANDING_REPOSITORY,
  IBrandingRepository,
} from '@infrastructure/repositories/abstraction/IBrandingRepository';
import { requirePermission } from '@application/common/Authorization';

import { currentBranding } from '../../BrandingReads';
import { BrandingResponse } from '../getbranding/BrandingResponse';
import { UpdateBrandingCommand } from './UpdateBrandingCommand';

@CommandHandler(UpdateBrandingCommand)
export class UpdateBrandingCommandHandler implements ICommandHandler<
  UpdateBrandingCommand,
  BrandingResponse
> {
  constructor(
    @Inject(BRANDING_REPOSITORY) private readonly repository: IBrandingRepository,
    @Inject(BRANDING_QUERIES) private readonly queries: IBrandingQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateBrandingCommand): Promise<BrandingResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'branding.edit');
    const branding = await this.repository.findColors(organizationId);
    const before = branding.colors;
    branding.applyColors(command.colors);

    await this.unitOfWork.run(async (tx) => {
      await this.repository.saveColors(branding, actor.userId, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'branding.updated',
          entityType: 'organization',
          entityId: organizationId,
          organizationId,
          oldValues: before,
          newValues: branding.colors,
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return currentBranding(this.queries, organizationId);
  }
}
