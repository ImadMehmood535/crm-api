import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { parseAssetKind, validateImage } from '@domain/aggregates/BrandingAggregate/BrandingImage';
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
import { UploadBrandingAssetCommand } from './UploadBrandingAssetCommand';

/** Raw image bytes; the format comes from the bytes, never from the declared Content-Type. */
@CommandHandler(UploadBrandingAssetCommand)
export class UploadBrandingAssetCommandHandler implements ICommandHandler<
  UploadBrandingAssetCommand,
  BrandingResponse
> {
  constructor(
    @Inject(BRANDING_REPOSITORY) private readonly repository: IBrandingRepository,
    @Inject(BRANDING_QUERIES) private readonly queries: IBrandingQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UploadBrandingAssetCommand): Promise<BrandingResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'branding.edit');
    const kind = parseAssetKind(command.kind);
    const contentType = validateImage(kind, command.bytes);

    await this.unitOfWork.run(async (tx) => {
      const id = await this.repository.replaceAsset(
        organizationId,
        kind,
        contentType,
        command.bytes,
        tx,
      );
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'branding.asset_uploaded',
          entityType: 'branding_asset',
          entityId: id,
          organizationId,
          newValues: { kind, contentType, sizeBytes: command.bytes.length },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return currentBranding(this.queries, organizationId);
  }
}
