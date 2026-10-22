import { Department } from '@domain/aggregates/DepartmentAggregate/Department';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const DEPARTMENT_REPOSITORY = Symbol('DEPARTMENT_REPOSITORY');

export interface IDepartmentRepository {
  save(department: Department, tx?: Tx): Promise<Department>;
  update(department: Department, tx?: Tx): Promise<void>;
  /** Active departments only. */
  findById(organizationId: string, id: string): Promise<Department | null>;
  activeNameExists(organizationId: string, nameKey: string, exceptId?: string): Promise<boolean>;
  hasActiveTeams(id: string): Promise<boolean>;
}
