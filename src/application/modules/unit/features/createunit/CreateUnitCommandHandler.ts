import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { NotFoundError } from '@shared/errors/AppError';
import { Unit } from '@domain/aggregates/UnitAggregate/Unit';
import { AUDIT_LOG, IAuditLog } from '@infrastructure/audit/abstraction/IAuditLog';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import {
  IInventoryQueries,
  INVENTORY_QUERIES,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IProjectRepository';
import {
  IUnitRepository,
  UNIT_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUnitRepository';
import { requirePermission } from '@application/common/Authorization';

import { UnitResponse } from '../getunit/UnitResponse';
import { unitNumberConflict } from '../../UnitRules';
import { CreateUnitCommand } from './CreateUnitCommand';

@CommandHandler(CreateUnitCommand)
export class CreateUnitCommandHandler implements ICommandHandler<CreateUnitCommand, UnitResponse> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: IUnitRepository,
    @Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries,
    @Inject(AUDIT_LOG) private readonly audit: IAuditLog,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateUnitCommand): Promise<UnitResponse> {
    const { actor, unit: input } = command;
    const organizationId = requirePermission(actor, 'units.create');
    if (!(await this.projects.findById(organizationId, command.projectId))) {
      throw new NotFoundError('Project not found.');
    }
    const unit = Unit.create({
      organizationId,
      projectId: command.projectId,
      number: input.number,
      type: input.type ?? null,
      status: input.status ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      floor: input.floor ?? null,
      areaSqm: input.areaSqm ?? null,
      price: input.price ?? null,
      notes: input.notes ?? null,
      createdBy: actor.userId,
    });
    if (await this.units.numberKeyExists(command.projectId, unit.numberKey))
      throw unitNumberConflict();

    const saved = await this.unitOfWork.run(async (tx) => {
      const created = await this.units.save(unit, tx);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'unit.created',
          entityType: 'unit',
          entityId: created.id,
          organizationId,
          newValues: {
            projectId: command.projectId,
            number: created.number,
            status: created.status,
          },
          ip: command.meta.ipAddress,
        },
        tx,
      );
      return created;
    });
    return UnitResponse.from((await this.inventory.findUnit(organizationId, saved.id as string))!);
  }
}
