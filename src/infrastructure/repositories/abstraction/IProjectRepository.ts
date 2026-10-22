import { Project } from '@domain/aggregates/ProjectAggregate/Project';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface IProjectRepository {
  save(project: Project, tx?: Tx): Promise<Project>;
  update(project: Project, tx?: Tx): Promise<void>;
  findById(organizationId: string, id: string): Promise<Project | null>;
  nameKeyExists(organizationId: string, nameKey: string, exceptId?: string): Promise<boolean>;
  hasUnits(id: string): Promise<boolean>;
  delete(id: string, tx?: Tx): Promise<void>;
}
