import { PageRequest } from '@shared/utils/Pagination';

export const INVENTORY_QUERIES = Symbol('INVENTORY_QUERIES');

export interface UnitCountsReadModel {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
}

/** The frontend's `Project`. */
export interface ProjectReadModel {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  currency: string;
  status: string;
  expectedCompletion: string | null;
  unitCounts: UnitCountsReadModel;
  createdAt: string;
  updatedAt: string;
}

/** The frontend's `Unit` (numbers as JSON numbers). */
export interface UnitReadModel {
  id: string;
  projectId: string;
  number: string;
  type: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  floor: number | null;
  price: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListFilter extends PageRequest {
  organizationId: string;
  search?: string;
  status?: string;
}

export interface UnitListFilter extends PageRequest {
  organizationId: string;
  projectId: string;
  search?: string;
  status?: string;
  type?: string;
}

export interface IInventoryQueries {
  findProjects(filter: ProjectListFilter): Promise<{ rows: ProjectReadModel[]; total: number }>;
  findProject(organizationId: string, id: string): Promise<ProjectReadModel | null>;
  findUnits(filter: UnitListFilter): Promise<{ rows: UnitReadModel[]; total: number }>;
  findUnit(organizationId: string, id: string): Promise<UnitReadModel | null>;
}
