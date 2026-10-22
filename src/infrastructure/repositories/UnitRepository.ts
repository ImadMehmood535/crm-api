import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { Unit } from '@domain/aggregates/UnitAggregate/Unit';
import { UnitModel } from '@domain/aggregates/UnitAggregate/UnitModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IUnitRepository } from './abstraction/IUnitRepository';

const toNumber = (value: string | null): number | null => (value === null ? null : Number(value));

@Injectable()
export class UnitRepository implements IUnitRepository {
  constructor(@InjectModel(UnitModel) private readonly unitModel: typeof UnitModel) {}

  async save(unit: Unit, tx?: Tx): Promise<Unit> {
    const row = await this.unitModel.create(
      {
        organizationId: unit.organizationId,
        projectId: unit.projectId,
        createdBy: unit.createdBy,
        ...this.columns(unit),
      },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async update(unit: Unit, tx?: Tx): Promise<void> {
    await this.unitModel.update(this.columns(unit), {
      where: { id: unit.id as string },
      transaction: tx as Transaction,
    });
  }

  async findById(organizationId: string, id: string): Promise<Unit | null> {
    const row = await this.unitModel.findOne({ where: { organizationId, id } });
    return row ? this.toDomain(row) : null;
  }

  async numberKeyExists(projectId: string, numberKey: string, exceptId?: string): Promise<boolean> {
    const where = exceptId
      ? { projectId, numberKey, id: { [Op.ne]: exceptId } }
      : { projectId, numberKey };
    return (await this.unitModel.count({ where })) > 0;
  }

  async delete(id: string, tx?: Tx): Promise<void> {
    await this.unitModel.destroy({ where: { id }, transaction: tx as Transaction });
  }

  private columns(unit: Unit): Partial<UnitModel> {
    return {
      number: unit.number,
      numberKey: unit.numberKey,
      numberSort: unit.numberSort,
      type: unit.type,
      status: unit.status,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      floor: unit.floor,
      areaSqm: unit.areaSqm === null ? null : String(unit.areaSqm),
      price: unit.price === null ? null : String(unit.price),
      notes: unit.notes,
    };
  }

  private toDomain(row: UnitModel): Unit {
    return Unit.rehydrate(
      row.id,
      row.organizationId,
      row.projectId,
      row.number,
      row.type,
      row.status,
      row.bedrooms,
      row.bathrooms,
      row.floor,
      toNumber(row.areaSqm),
      toNumber(row.price),
      row.notes,
    );
  }
}
