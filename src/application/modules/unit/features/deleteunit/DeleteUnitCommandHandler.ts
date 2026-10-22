import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IUnitRepository,
  UNIT_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUnitRepository';
import { requirePermission } from '@application/common/Authorization';

import { unitNotFound } from '../../UnitRules';
import { DeleteUnitCommand } from './DeleteUnitCommand';

@CommandHandler(DeleteUnitCommand)
export class DeleteUnitCommandHandler implements ICommandHandler<DeleteUnitCommand, null> {
  constructor(
    @Inject(UNIT_REPOSITORY) private readonly units: IUnitRepository,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: DeleteUnitCommand): Promise<null> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'units.delete');
    const unit = await this.units.findById(organizationId, command.id);
    if (!unit) throw unitNotFound();

    await this.unitOfWork.run(async (tx) => {
      await this.units.delete(command.id, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'unit.deleted',
          entityType: 'unit',
          entityId: command.id,
          organizationId,
          oldValues: { projectId: unit.projectId, number: unit.number },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return null;
  }
}
