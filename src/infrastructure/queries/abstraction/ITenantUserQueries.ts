import { PageRequest } from '@shared/utils/Pagination';

export const TENANT_USER_QUERIES = Symbol('TENANT_USER_QUERIES');

/** The frontend's `TenantUser`. */
export interface TenantUserReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive' | 'suspended';
  isOwner: boolean;
  roles: Array<{ id: string; name: string; code: string }>;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TenantUserListFilter extends PageRequest {
  organizationId: string;
  search?: string;
  status?: string;
}

export interface ITenantUserQueries {
  findList(filter: TenantUserListFilter): Promise<{ rows: TenantUserReadModel[]; total: number }>;
  findById(organizationId: string, id: string): Promise<TenantUserReadModel | null>;
}
