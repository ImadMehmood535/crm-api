import { ValidationFailedError } from '@shared/errors/AppError';

import { oneOf, optionalText, requiredText } from './Guards';

describe('Guards', () => {
  describe('requiredText', () => {
    it('should trim the value', () => {
      expect(requiredText('  Ali  ', 'name', 'Name', 10)).toBe('Ali');
    });

    it('should throw ValidationFailedError for the field when blank', () => {
      const act = (): string => requiredText('   ', 'name', 'Name', 10);

      expect(act).toThrow(ValidationFailedError);
      expect(act).toThrow('Name is required.');
    });

    it('should accept exactly max characters and reject max+1', () => {
      expect(requiredText('a'.repeat(10), 'name', 'Name', 10)).toHaveLength(10);
      expect(() => requiredText('a'.repeat(11), 'name', 'Name', 10)).toThrow(
        'Name must be 10 characters or fewer.',
      );
    });
  });

  describe('optionalText', () => {
    it.each([null, undefined, '  '])('should return null for %p', (value) => {
      expect(optionalText(value, 'notes', 'Notes', 10)).toBeNull();
    });

    it('should trim a present value', () => {
      expect(optionalText(' x ', 'notes', 'Notes', 10)).toBe('x');
    });
  });

  describe('oneOf', () => {
    it('should return an allowed value', () => {
      expect(oneOf('a', ['a', 'b'], 'kind', 'Kind')).toBe('a');
    });

    it('should throw with the allowed list when the value is not allowed', () => {
      expect(() => oneOf('c', ['a', 'b'], 'kind', 'Kind')).toThrow('Kind must be one of: a, b.');
    });
  });
});
