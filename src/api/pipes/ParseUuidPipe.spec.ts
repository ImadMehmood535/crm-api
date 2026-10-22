import { NotFoundError } from '@shared/errors/AppError';

import { ParseUuidPipe } from './ParseUuidPipe';

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();

  it('should pass a UUID through in lowercase', () => {
    expect(pipe.transform('0192F3A4-0000-7000-8000-000000000001')).toBe(
      '0192f3a4-0000-7000-8000-000000000001',
    );
  });

  it('should throw NotFoundError when the value is not a UUID', () => {
    expect(() => pipe.transform('abc')).toThrow(NotFoundError);
  });
});
