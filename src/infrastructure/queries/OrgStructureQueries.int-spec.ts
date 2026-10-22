import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createHierarchy } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { Department } from '../../domain/aggregates/DepartmentAggregate/Department';
import { Team } from '../../domain/aggregates/TeamAggregate/Team';
import { UserLevel } from '../../shared/auth/UserLevel';
import { OrgStructurePersistenceModule } from '../persistence/OrgStructurePersistenceModule';
import {
  DEPARTMENT_REPOSITORY,
  IDepartmentRepository,
} from '../repositories/abstraction/IDepartmentRepository';
import { ITeamRepository, TEAM_REPOSITORY } from '../repositories/abstraction/ITeamRepository';
import { IOrgStructureQueries, ORG_STRUCTURE_QUERIES } from './abstraction/IOrgStructureQueries';

describe('Org structure persistence (departments, teams, membership)', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let departments: IDepartmentRepository;
  let teams: ITeamRepository;
  let queries: IOrgStructureQueries;
  let h: Record<string, string>;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([OrgStructurePersistenceModule]));
    departments = moduleRef.get(DEPARTMENT_REPOSITORY);
    teams = moduleRef.get(TEAM_REPOSITORY);
    queries = moduleRef.get(ORG_STRUCTURE_QUERIES);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    h = await createHierarchy(sequelize);
  });
  afterAll(() => moduleRef.close());

  const departmentsSeenBy = async (who: string, level: UserLevel): Promise<string[]> => {
    const { rows } = await queries.findDepartments({
      organizationId: h.org,
      page: 1,
      pageSize: 50,
      viewer: { userId: h[who], level },
    });
    return rows.map((r) => r.name);
  };
  const teamsSeenBy = async (
    who: string,
    level: UserLevel,
    departmentId?: string,
  ): Promise<string[]> => {
    const { rows } = await queries.findTeams({
      organizationId: h.org,
      page: 1,
      pageSize: 50,
      departmentId,
      viewer: { userId: h[who], level },
    });
    return rows.map((r) => r.name);
  };

  it('should save a department, enforce active-name uniqueness and free the name on deactivation', async () => {
    const saved = await departments.save(Department.create(h.org, 'Sales', h.head1, h.owner));

    expect(await departments.activeNameExists(h.org, 'sales')).toBe(true);
    expect(await departments.activeNameExists(h.org, 'sales', saved.id as string)).toBe(false);
    saved.deactivate();
    await departments.update(saved);
    expect(await departments.activeNameExists(h.org, 'sales')).toBe(false);
    expect(await departments.findById(h.org, saved.id as string)).toBeNull();
  });

  it('should report active teams and members, and add members idempotently', async () => {
    expect(await departments.hasActiveTeams(h.finance)).toBe(true);
    const team = await teams.save(Team.create(h.org, h.finance, 'Receivables', h.head1));

    expect(await teams.hasMembers(team.id as string)).toBe(false);
    await teams.addMember(team.id as string, h.member1, h.head1);
    await teams.addMember(team.id as string, h.member1, h.head1);
    expect((await queries.findTeam(h.org, team.id as string))?.members.map((m) => m.id)).toEqual([
      h.member1,
    ]);
    await teams.removeMember(team.id as string, h.member1);
    expect(await teams.hasMembers(team.id as string)).toBe(false);
    expect(await teams.activeNameExists(h.finance, 'receivables')).toBe(true);
    expect(await teams.activeNameExists(h.hr, 'receivables')).toBe(false);
  });

  it('should read a department with its head and counts', async () => {
    const finance = await queries.findDepartment(h.org, h.finance);

    expect(finance).toMatchObject({ name: 'Finance', teamCount: 1, memberCount: 2 });
    expect(finance?.head?.id).toBe(h.head1);
  });

  it('should scope department lists by level', async () => {
    expect(await departmentsSeenBy('owner', 'owner')).toEqual(['Finance', 'HR']);
    expect(await departmentsSeenBy('admin2', 'admin')).toEqual(['Finance', 'HR']);
    expect(await departmentsSeenBy('head1', 'department_head')).toEqual(['Finance']);
    expect(await departmentsSeenBy('member3', 'member')).toEqual(['HR']);
  });

  it('should scope team lists by level and filter by department', async () => {
    expect(await teamsSeenBy('admin1', 'admin')).toEqual(['Hiring', 'Payables']);
    expect(await teamsSeenBy('owner', 'owner', h.hr)).toEqual(['Hiring']);
    expect(await teamsSeenBy('head2', 'department_head')).toEqual(['Hiring']);
    expect(await teamsSeenBy('member1', 'member')).toEqual(['Payables']);
  });
});
