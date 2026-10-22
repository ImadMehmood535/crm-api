import { ValidationFailedError } from '@shared/errors/AppError';

import { Unit } from './Unit';

const props = {
  organizationId: 'org-1',
  projectId: 'p1',
  number: ' A-101 ',
  type: null,
  status: null,
  bedrooms: 3,
  bathrooms: 2,
  floor: 1,
  areaSqm: 120.5,
  price: 250000.25,
  notes: null,
  createdBy: 'u1',
};

describe('Unit', () => {
  it('should default to an available apartment with a trimmed number and sort key', () => {
    const unit = Unit.create(props);

    expect(unit.number).toBe('A-101');
    expect(unit.type).toBe('apartment');
    expect(unit.status).toBe('available');
    expect(unit.numberSort).toBe('a-0000000101');
  });

  it.each([
    ['number', { number: ' ' }],
    ['number', { number: 'n'.repeat(41) }],
    ['type', { type: 'castle' }],
    ['status', { status: 'gone' }],
    ['bedrooms', { bedrooms: 2.5 }],
    ['bedrooms', { bedrooms: 51 }],
    ['bathrooms', { bathrooms: -1 }],
    ['floor', { floor: 201 }],
    ['floor', { floor: -6 }],
    ['areaSqm', { areaSqm: 0 }],
    ['areaSqm', { areaSqm: 10.123 }],
    ['price', { price: -1 }],
    ['price', { price: 100_000_000_000 }],
    ['notes', { notes: 'n'.repeat(2001) }],
  ])('should reject a bad %s on that field', (field, overrides) => {
    const act = (): Unit => Unit.create({ ...props, ...overrides });

    expect(act).toThrow(ValidationFailedError);
    expect(act).toThrow(
      expect.objectContaining({ details: [expect.objectContaining({ field })] }) as Error,
    );
  });

  it('should accept the limits exactly', () => {
    const unit = Unit.create({
      ...props,
      bedrooms: 50,
      floor: -5,
      price: 99_999_999_999.99,
      areaSqm: 0.01,
      number: 'n'.repeat(40),
    });

    expect(unit.price).toBe(99_999_999_999.99);
    expect(unit.floor).toBe(-5);
  });

  it('should clear optional numbers with null and change status', () => {
    const unit = Unit.create(props);

    unit.setLayout(null, null, null);
    unit.setPrice(null);
    unit.changeStatus('sold');

    expect(unit.bedrooms).toBeNull();
    expect(unit.price).toBeNull();
    expect(unit.status).toBe('sold');
  });
});
