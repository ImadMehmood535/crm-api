import { PageRequest } from '@shared/utils/Pagination';

export const RBAC_QUERIES = Symbol('RBAC_QUERIES');

/** One row of the frontend's permission matrix. */
export interface PermissionModuleReadModel {
  module: string;
  label: string;
  actions: Array<{ action: string; label: string; code: string }>;
}

/** The frontend's `Role`. */
export interface RoleReadModel {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

export interface RoleListFilter extends PageRequest {
  organizationId: string;
  search?: string;
}

export interface IRbacQueries {
  catalogue(): Promise<PermissionModuleReadModel[]>;
  allCodes(): Promise<string[]>;
  findRoles(filter: RoleListFilter): Promise<{ rows: RoleReadModel[]; total: number }>;
  /** Active roles only. */
  findRole(organizationId: string, id: string): Promise<RoleReadModel | null>;
}
