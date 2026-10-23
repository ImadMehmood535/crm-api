import { RoleLevel } from '@shared/auth/LevelRoles';
import { Role } from '@domain/aggregates/RoleAggregate/Role';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export const OWNER_ROLE_CODE = 'developer_super_user';

export interface IRoleRepository {
  /** Creates the company's built-in owner role (system, read-only) and returns its id. */
  createOwnerRole(organizationId: string, tx?: Tx): Promise<string>;
  findPlatformRoleId(code: string): Promise<string | null>;
  /** Id of the company's built-in role for this level, created on first use. */
  levelRoleId(organizationId: string, level: RoleLevel, tx?: Tx): Promise<string>;

  /** Inserts a company role with its grants; returns it with its id. */
  saveTenantRole(role: Role, grantedBy: string, tx?: Tx): Promise<Role>;
  /** Persists name, code, description, active flag and replaces the grant set. */
  updateTenantRole(role: Role, grantedBy: string, tx?: Tx): Promise<void>;
  findTenantRole(organizationId: string, id: string): Promise<Role | null>;
  findActiveTenantRoles(organizationId: string, ids: readonly string[]): Promise<Role[]>;
  activeCodeExists(organizationId: string, code: string, exceptId?: string): Promise<boolean>;
  countHolders(roleId: string): Promise<number>;
}
