import { Department } from '../../src/domain/aggregates/DepartmentAggregate/Department';
import { Team } from '../../src/domain/aggregates/TeamAggregate/Team';
import {
  DepartmentReadModel,
  IOrgStructureQueries,
  TeamReadModel,
} from '../../src/infrastructure/queries/abstraction/IOrgStructureQueries';
import { IDepartmentRepository } from '../../src/infrastructure/repositories/abstraction/IDepartmentRepository';
import { ITeamRepository } from '../../src/infrastructure/repositories/abstraction/ITeamRepository';
import { UserLevel } from '../../src/shared/auth/UserLevel';
import { actor } from './auth-mocks';
import { ALL_CODES } from './tenant-mocks';

/** A caller at a level, holding every tenant permission (so only level/scope rules decide). */
export const atLevel = (level: UserLevel, userId = `${level}-1`) =>
  actor({ userId, level, permissions: ALL_CODES, roles: ['staff'], isSuperUser: false });

export const department = (headUserId: string | null = 'department_head-1'): Department =>
  Department.rehydrate('dep-1', 'org-1', 'Finance', headUserId, true);
export const team = (): Team => Team.rehydrate('team-1', 'org-1', 'dep-1', 'Payables', true);

export const departmentReadModel = (): DepartmentReadModel => ({
  id: 'dep-1',
  name: 'Finance',
  head: null,
  teamCount: 0,
  memberCount: 0,
  createdAt: '2026-10-23T00:00:00.000Z',
});

export const teamReadModel = (): TeamReadModel => ({
  id: 'team-1',
  name: 'Payables',
  department: { id: 'dep-1', name: 'Finance' },
  members: [],
  createdAt: '2026-10-23T00:00:00.000Z',
});

export function departmentRepository(): jest.Mocked<IDepartmentRepository> {
  return {
    save: jest
      .fn()
      .mockImplementation((d: Department) =>
        Promise.resolve(
          Department.rehydrate('dep-1', d.organizationId, d.name, d.headUserId, true),
        ),
      ),
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(department()),
    activeNameExists: jest.fn().mockResolvedValue(false),
    hasActiveTeams: jest.fn().mockResolvedValue(false),
  };
}

export function teamRepository(): jest.Mocked<ITeamRepository> {
  return {
    save: jest
      .fn()
      .mockImplementation((t: Team) =>
        Promise.resolve(Team.rehydrate('team-1', t.organizationId, t.departmentId, t.name, true)),
      ),
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(team()),
    activeNameExists: jest.fn().mockResolvedValue(false),
    hasMembers: jest.fn().mockResolvedValue(false),
    addMember: jest.fn().mockResolvedValue(undefined),
    removeMember: jest.fn().mockResolvedValue(undefined),
  };
}

export function orgStructureQueries(): jest.Mocked<IOrgStructureQueries> {
  return {
    findDepartments: jest.fn().mockResolvedValue({ rows: [departmentReadModel()], total: 1 }),
    findDepartment: jest.fn().mockResolvedValue(departmentReadModel()),
    findTeams: jest.fn().mockResolvedValue({ rows: [teamReadModel()], total: 1 }),
    findTeam: jest.fn().mockResolvedValue(teamReadModel()),
  };
}
