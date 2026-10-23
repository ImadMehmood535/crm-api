import { UserLevel } from '@shared/auth/UserLevel';
import { PageRequest } from '@shared/utils/Pagination';

export const TENANT_USER_QUERIES = Symbol('TENANT_USER_QUERIES');

/** The frontend's `TenantUser`. */
export interface TenantUserReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive' | 'suspended';
  level: UserLevel;
  isOwner: boolean;
  roles: Array<{ id: string; name: string; code: string }>;
  teams: Array<{ id: string; name: string }>;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

/** Whose eyes the list is seen through (hierarchy visibility). */
export interface Viewer {
  userId: string;
  level: UserLevel;
}

export interface TenantUserListFilter extends PageRequest {
  organizationId: string;
  viewer: Viewer;
  search?: string;
  status?: string;
}

/** A user's permissions split by source (all sorted). */
export interface PermissionBreakdownReadModel {
  rolePermissions: string[];
  granted: string[];
  revoked: string[];
  permissions: string[];
}

export interface ITenantUserQueries {
  /** Role codes, overrides and the effective set of one user (no visibility check). */
  findPermissionBreakdown(userId: string): Promise<PermissionBreakdownReadModel>;
  findList(filter: TenantUserListFilter): Promise<{ rows: TenantUserReadModel[]; total: number }>;
  /** null when the user does not exist in this company or the viewer may not see them. */
  findById(organizationId: string, id: string, viewer: Viewer): Promise<TenantUserReadModel | null>;
}
