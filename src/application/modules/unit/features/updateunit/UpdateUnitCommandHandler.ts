import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { Unit } from '@domain/aggregates/UnitAggregate/Unit';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IInventoryQueries,
  INVENTORY_QUERIES,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import {
  IUnitRepository,
  UNIT_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUnitRepository';
import { requirePermission } from '@application/common/Authorization';

import { UpdateUnitRequest } from '../createunit/UnitRequest';
import { UnitResponse } from '../getunit/UnitResponse';
import { unitNotFound, unitNumberConflict } from '../../UnitRules';
import { UpdateUnitCommand } from './UpdateUnitCommand';

const pick = <T>(change: T | undefined, current: T): T => (change === undefined ? current : change);

/** PATCH: undefined = unchanged, null = cleared (type and status cannot be cleared). */
function apply(unit: Unit, changes: UpdateUnitRequest): void {
  if (changes.number !== undefined) unit.renumber(changes.number);
  if (changes.type !== undefined && changes.type !== null) unit.changeType(changes.type);
  if (changes.status !== undefined && changes.status !== null) unit.changeStatus(changes.status);
  unit.setLayout(
    pick(changes.bedrooms, unit.bedrooms),
    pick(changes.bathrooms, unit.bathrooms),
    pick(changes.floor, unit.floor),
  );
  if (changes.areaSqm !== undefined) unit.setArea(changes.areaSqm);
  if (changes.price !== undefined) unit.setPrice(changes.price);
  if (changes.notes !== undefined) unit.annotate(changes.notes);
}

@CommandHandler(UpdateUnitCommand)
export class UpdateUnitCommandHandler implements ICommandHandler<UpdateUnitCommand, UnitResponse> {
  constructor(
    @Inject(UNIT_REPOSITORY) private readonly units: IUnitRepository,
    @Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateUnitCommand): Promise<UnitResponse> {
    const { actor } = command;
    const organizationId = requirePermission(actor, 'units.edit');
    const unit = await this.units.findById(organizationId, command.id);
    if (!unit) throw unitNotFound();
    const before = { number: unit.number, status: unit.status };
    apply(unit, command.changes);
    if (await this.units.numberKeyExists(unit.projectId, unit.numberKey, command.id))
      throw unitNumberConflict();

    await this.unitOfWork.run(async (tx) => {
      await this.units.update(unit, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'unit.updated',
          entityType: 'unit',
          entityId: command.id,
          organizationId,
          oldValues: before,
          newValues: { number: unit.number, status: unit.status },
          ip: command.meta.ipAddress,
        },
        tx,
      );
    });
    return UnitResponse.from((await this.inventory.findUnit(organizationId, command.id))!);
  }
}
