import { PageRequest } from '@shared/utils/Pagination';

export const DEVELOPER_QUERIES = Symbol('DEVELOPER_QUERIES');

/** The frontend's `Developer`. */
export interface DeveloperReadModel {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  createdAt: string;
  userCount: number;
  superUser: { id: string; email: string; name: string } | null;
}

export interface DeveloperListFilter extends PageRequest {
  search?: string;
  status?: string;
}

export interface IDeveloperQueries {
  findList(filter: DeveloperListFilter): Promise<{ rows: DeveloperReadModel[]; total: number }>;
  findById(id: string): Promise<DeveloperReadModel | null>;
}
