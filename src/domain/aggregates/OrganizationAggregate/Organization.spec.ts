import { ValidationFailedError } from '@shared/errors/AppError';

import { Organization, normalizeSlug } from './Organization';

describe('Organization', () => {
  describe('create', () => {
    it('should start active with a trimmed name and a lowercased slug', () => {
      const organization = Organization.create({
        name: '  Palm Estates ',
        slug: 'Palm-Estates',
        createdBy: 'u1',
      });

      expect(organization.id).toBeNull();
      expect(organization.name).toBe('Palm Estates');
      expect(organization.slug).toBe('palm-estates');
      expect(organization.status).toBe('active');
      expect(organization.createdBy).toBe('u1');
    });

    it('should reject a name shorter than 2 characters on name', () => {
      const act = (): Organization =>
        Organization.create({ name: 'A', slug: 'abc', createdBy: null });

      expect(act).toThrow(ValidationFailedError);
      expect(act).toThrow('Company name must be at least 2 characters.');
    });

    it('should accept 120 characters and reject 121', () => {
      expect(
        Organization.create({ name: 'a'.repeat(120), slug: 'ab', createdBy: null }).name,
      ).toHaveLength(120);
      expect(() =>
        Organization.create({ name: 'a'.repeat(121), slug: 'ab', createdBy: null }),
      ).toThrow('Company name must be 120 characters or fewer.');
    });
  });

  describe('normalizeSlug', () => {
    it.each(['a', 'a'.repeat(41), 'bad slug', 'double--hyphen', '-edge', 'émoji'])(
      'should reject %p on slug',
      (slug) => {
        expect(() => normalizeSlug(slug)).toThrow(
          expect.objectContaining({
            code: 'VALIDATION_FAILED',
            details: [expect.objectContaining({ field: 'slug' })],
          }) as Error,
        );
      },
    );

    it('should accept 2 and 40 characters', () => {
      expect(normalizeSlug('ab')).toBe('ab');
      expect(normalizeSlug('a'.repeat(40))).toHaveLength(40);
    });

    it('should answer SLUG_RESERVED for a reserved word', () => {
      expect(() => normalizeSlug('Admin')).toThrow(
        expect.objectContaining({ status: 422, code: 'SLUG_RESERVED' }) as Error,
      );
    });

    it('should report on the given field', () => {
      expect(() => normalizeSlug('x', 'invite.slug')).toThrow(
        expect.objectContaining({
          details: [expect.objectContaining({ field: 'invite.slug' })],
        }) as Error,
      );
    });
  });

  describe('suspend / reactivate', () => {
    it('should change status once and report no change when repeated', () => {
      const organization = Organization.rehydrate('o1', 'Palm', 'palm', 'active', null);

      expect(organization.suspend()).toBe(true);
      expect(organization.suspend()).toBe(false);
      expect(organization.status).toBe('suspended');
      expect(organization.reactivate()).toBe(true);
      expect(organization.reactivate()).toBe(false);
      expect(organization.status).toBe('active');
    });
  });
});
