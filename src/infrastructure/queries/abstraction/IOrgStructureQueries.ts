import { PageRequest } from '@shared/utils/Pagination';

import { Viewer } from './ITenantUserQueries';

export const ORG_STRUCTURE_QUERIES = Symbol('ORG_STRUCTURE_QUERIES');

export interface PersonReadModel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** The frontend's `Department`. */
export interface DepartmentReadModel {
  id: string;
  name: string;
  head: PersonReadModel | null;
  teamCount: number;
  memberCount: number;
  createdAt: string;
}

/** The frontend's `Team`. */
export interface TeamReadModel {
  id: string;
  name: string;
  department: { id: string; name: string };
  members: PersonReadModel[];
  createdAt: string;
}

export interface DepartmentListFilter extends PageRequest {
  organizationId: string;
  viewer: Viewer;
}

export interface TeamListFilter extends PageRequest {
  organizationId: string;
  viewer: Viewer;
  departmentId?: string;
}

export interface IOrgStructureQueries {
  findDepartments(
    filter: DepartmentListFilter,
  ): Promise<{ rows: DepartmentReadModel[]; total: number }>;
  findDepartment(organizationId: string, id: string): Promise<DepartmentReadModel | null>;
  findTeams(filter: TeamListFilter): Promise<{ rows: TeamReadModel[]; total: number }>;
  findTeam(organizationId: string, id: string): Promise<TeamReadModel | null>;
}
