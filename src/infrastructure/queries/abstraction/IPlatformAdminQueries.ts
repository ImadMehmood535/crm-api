import { PageRequest } from '@shared/utils/Pagination';

export const PLATFORM_ADMIN_QUERIES = Symbol('PLATFORM_ADMIN_QUERIES');

/** The frontend's `PlatformAdmin`. */
export interface PlatformAdminReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'platform_super_user' | 'platform_admin';
  isActive: boolean;
  createdAt: string;
}

export interface IPlatformAdminQueries {
  findList(page: PageRequest): Promise<{ rows: PlatformAdminReadModel[]; total: number }>;
  findById(id: string): Promise<PlatformAdminReadModel | null>;
}
