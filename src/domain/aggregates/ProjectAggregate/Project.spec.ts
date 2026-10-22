import { ValidationFailedError } from '@shared/errors/AppError';

import { nameKey, naturalSortKey } from './InventoryText';
import { Project } from './Project';

const props = {
  organizationId: 'org-1',
  name: '  Palm Heights ',
  description: null,
  city: 'Lahore',
  address: null,
  currency: 'pkr',
  status: null,
  expectedCompletion: '2027-06-30',
  createdBy: 'u1',
};

describe('Project', () => {
  it('should default status to planning, uppercase the currency and trim the name', () => {
    const project = Project.create(props);

    expect(project.name).toBe('Palm Heights');
    expect(project.nameKey).toBe('palm heights');
    expect(project.currency).toBe('PKR');
    expect(project.status).toBe('planning');
    expect(Project.create({ ...props, currency: null }).currency).toBe('USD');
  });

  it.each([
    ['name', { name: 'A' }],
    ['name', { name: 'a'.repeat(121) }],
    ['currency', { currency: 'RS' }],
    ['status', { status: 'done' }],
    ['expectedCompletion', { expectedCompletion: '2027-13-40' }],
    ['description', { description: 'd'.repeat(2001) }],
    ['city', { city: 'c'.repeat(101) }],
    ['address', { address: 'a'.repeat(301) }],
  ])('should reject a bad %s on that field', (field, overrides) => {
    const act = (): Project => Project.create({ ...props, ...overrides });

    expect(act).toThrow(ValidationFailedError);
    expect(act).toThrow(
      expect.objectContaining({ details: [expect.objectContaining({ field })] }) as Error,
    );
  });

  it('should accept the limits exactly', () => {
    const project = Project.create({
      ...props,
      name: 'a'.repeat(120),
      description: 'd'.repeat(2000),
    });

    expect(project.name).toHaveLength(120);
  });

  it('should clear optional fields with null', () => {
    const project = Project.create(props);

    project.relocate(null, null);
    project.scheduleCompletion(null);

    expect(project.city).toBeNull();
    expect(project.expectedCompletion).toBeNull();
  });
});

describe('InventoryText', () => {
  it('should compare names ignoring case and repeated spaces', () => {
    expect(nameKey('  Palm   HEIGHTS ')).toBe('palm heights');
  });

  it('should sort numbers naturally', () => {
    const sorted = ['A-10', 'A-2', 'a-1', 'B-1'].sort((x, y) =>
      naturalSortKey(x).localeCompare(naturalSortKey(y)),
    );

    expect(sorted).toEqual(['a-1', 'A-2', 'A-10', 'B-1']);
  });
});
