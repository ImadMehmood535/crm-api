import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export const OWNER_ROLE_CODE = 'developer_super_user';

export interface IRoleRepository {
  /** Creates the company's built-in owner role (system, read-only) and returns its id. */
  createOwnerRole(organizationId: string, tx?: Tx): Promise<string>;
  findPlatformRoleId(code: string): Promise<string | null>;
}
