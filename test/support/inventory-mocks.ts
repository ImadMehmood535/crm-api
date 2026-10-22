import { Project } from '../../src/domain/aggregates/ProjectAggregate/Project';
import { Unit } from '../../src/domain/aggregates/UnitAggregate/Unit';
import {
  IInventoryQueries,
  ProjectReadModel,
  UnitReadModel,
} from '../../src/infrastructure/queries/abstraction/IInventoryQueries';
import { IProjectRepository } from '../../src/infrastructure/repositories/abstraction/IProjectRepository';
import { IUnitRepository } from '../../src/infrastructure/repositories/abstraction/IUnitRepository';

export const project = (): Project =>
  Project.rehydrate('p1', 'org-1', 'Palm Heights', null, 'Lahore', null, 'PKR', 'planning', null);
export const unit = (): Unit =>
  Unit.rehydrate(
    'u1',
    'org-1',
    'p1',
    'A-1',
    'apartment',
    'available',
    null,
    null,
    null,
    null,
    null,
    null,
  );

export const projectReadModel = (): ProjectReadModel => ({
  id: 'p1',
  name: 'Palm Heights',
  description: null,
  city: 'Lahore',
  address: null,
  currency: 'PKR',
  status: 'planning',
  expectedCompletion: null,
  unitCounts: { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 },
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

export const unitReadModel = (): UnitReadModel => ({
  id: 'u1',
  projectId: 'p1',
  number: 'A-1',
  type: 'apartment',
  status: 'available',
  bedrooms: null,
  bathrooms: null,
  areaSqm: null,
  floor: null,
  price: null,
  notes: null,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

export function projectRepository(): jest.Mocked<IProjectRepository> {
  return {
    save: jest
      .fn()
      .mockImplementation((p: Project) =>
        Promise.resolve(
          Project.rehydrate(
            'p1',
            p.organizationId,
            p.name,
            p.description,
            p.city,
            p.address,
            p.currency,
            p.status,
            p.expectedCompletion,
          ),
        ),
      ),
    update: jest.fn(),
    findById: jest.fn().mockResolvedValue(project()),
    nameKeyExists: jest.fn().mockResolvedValue(false),
    hasUnits: jest.fn().mockResolvedValue(false),
    delete: jest.fn(),
  };
}

export function unitRepository(): jest.Mocked<IUnitRepository> {
  return {
    save: jest.fn().mockResolvedValue(unit()),
    update: jest.fn(),
    findById: jest.fn().mockResolvedValue(unit()),
    numberKeyExists: jest.fn().mockResolvedValue(false),
    delete: jest.fn(),
  };
}

export function inventoryQueries(): jest.Mocked<IInventoryQueries> {
  return {
    findProjects: jest.fn().mockResolvedValue({ rows: [projectReadModel()], total: 1 }),
    findProject: jest.fn().mockResolvedValue(projectReadModel()),
    findUnits: jest.fn().mockResolvedValue({ rows: [unitReadModel()], total: 1 }),
    findUnit: jest.fn().mockResolvedValue(unitReadModel()),
  };
}
