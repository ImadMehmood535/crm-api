import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { parseAssetKind } from '@domain/aggregates/BrandingAggregate/BrandingImage';
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
import { RemoveBrandingAssetCommand } from './RemoveBrandingAssetCommand';

@CommandHandler(RemoveBrandingAssetCommand)
export class RemoveBrandingAssetCommandHandler implements ICommandHandler<
  RemoveBrandingAssetCommand,
  BrandingResponse
> {
  constructor(
    @Inject(BRANDING_REPOSITORY) private readonly repository: IBrandingRepository,
    @Inject(BRANDING_QUERIES) private readonly queries: IBrandingQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: RemoveBrandingAssetCommand): Promise<BrandingResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'branding.edit');
    const kind = parseAssetKind(command.kind);

    await this.unitOfWork.run(async (tx) => {
      await this.repository.removeAsset(organizationId, kind, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'branding.asset_removed',
          entityType: 'organization',
          entityId: organizationId,
          organizationId,
          oldValues: { kind },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return currentBranding(this.queries, organizationId);
  }
}
