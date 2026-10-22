import { Organization } from '@domain/aggregates/OrganizationAggregate/Organization';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');

export interface IOrganizationRepository {
  save(organization: Organization, tx?: Tx): Promise<Organization>;
  update(organization: Organization, tx?: Tx): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  slugExists(slug: string): Promise<boolean>;
}
