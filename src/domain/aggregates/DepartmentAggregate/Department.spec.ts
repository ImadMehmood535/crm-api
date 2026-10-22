import { ValidationFailedError } from '@shared/errors/AppError';

import { Team } from '../TeamAggregate/Team';
import { Department } from './Department';

describe('Department', () => {
  it('should trim the name, keep the head and start active', () => {
    const department = Department.create('org-1', '  Finance ', 'head-1', 'owner-1');

    expect(department.name).toBe('Finance');
    expect(department.nameKey).toBe('finance');
    expect(department.headUserId).toBe('head-1');
    expect(department.isActive).toBe(true);
  });

  it('should accept 2 and 100 characters and reject 1 and 101 on name', () => {
    expect(Department.create('org-1', 'HR', null, 'o').name).toBe('HR');
    expect(Department.create('org-1', 'd'.repeat(100), null, 'o').name).toHaveLength(100);
    expect(() => Department.create('org-1', 'H', null, 'o')).toThrow(ValidationFailedError);
    expect(() => Department.create('org-1', 'd'.repeat(101), null, 'o')).toThrow(
      'Department name must be 100 characters or fewer.',
    );
  });

  it('should change the head and deactivate', () => {
    const department = Department.rehydrate('d1', 'org-1', 'Finance', 'h1', true);

    department.assignHead(null);
    department.deactivate();

    expect(department.headUserId).toBeNull();
    expect(department.isActive).toBe(false);
  });
});

describe('Team', () => {
  it('should belong to a department with a validated name', () => {
    const team = Team.create('org-1', 'd1', ' Payables ', 'h1');

    expect(team.departmentId).toBe('d1');
    expect(team.name).toBe('Payables');
    expect(() => team.rename('P')).toThrow('Team name must be at least 2 characters.');
  });

  it('should deactivate', () => {
    const team = Team.rehydrate('t1', 'org-1', 'd1', 'Payables', true);

    team.deactivate();

    expect(team.isActive).toBe(false);
  });
});
