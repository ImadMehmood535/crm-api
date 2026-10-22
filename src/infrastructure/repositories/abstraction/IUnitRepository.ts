import { Unit } from '@domain/aggregates/UnitAggregate/Unit';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const UNIT_REPOSITORY = Symbol('UNIT_REPOSITORY');

export interface IUnitRepository {
  save(unit: Unit, tx?: Tx): Promise<Unit>;
  update(unit: Unit, tx?: Tx): Promise<void>;
  findById(organizationId: string, id: string): Promise<Unit | null>;
  numberKeyExists(projectId: string, numberKey: string, exceptId?: string): Promise<boolean>;
  delete(id: string, tx?: Tx): Promise<void>;
}
