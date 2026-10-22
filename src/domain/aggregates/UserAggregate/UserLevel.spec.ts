import { ForbiddenError } from '@shared/errors/AppError';

import { assertCanCreateLevel, canCreateLevel } from './UserLevel';

describe('UserLevel', () => {
  it.each([
    ['owner', 'admin', true],
    ['owner', 'department_head', true],
    ['owner', 'member', true],
    ['owner', 'owner', false],
    ['admin', 'admin', false],
    ['admin', 'department_head', true],
    ['admin', 'member', true],
    ['department_head', 'department_head', false],
    ['department_head', 'member', true],
    ['member', 'member', false],
  ] as const)('should let %s create %s: %s', (actor, level, expected) => {
    expect(canCreateLevel(actor, level)).toBe(expected);
  });

  it('should answer FORBIDDEN_OPERATION when not allowed', () => {
    expect(() => assertCanCreateLevel('admin', 'admin')).toThrow(ForbiddenError);
    expect(() => assertCanCreateLevel('admin', 'admin')).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN_OPERATION' }) as Error,
    );
  });
});
