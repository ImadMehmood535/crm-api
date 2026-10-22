import { Session } from './Session';

describe('Session', () => {
  const now = new Date('2026-10-23T00:00:00Z');
  const later = new Date('2026-11-01T00:00:00Z');
  const earlier = new Date('2026-10-01T00:00:00Z');

  describe('isActive', () => {
    it('should be active when not revoked, not rotated and not expired', () => {
      expect(Session.rehydrate('s', 'u', 'f', later, null, null).isActive(now)).toBe(true);
    });

    it('should not be active when expired', () => {
      expect(Session.rehydrate('s', 'u', 'f', earlier, null, null).isActive(now)).toBe(false);
    });

    it('should not be active when revoked', () => {
      expect(Session.rehydrate('s', 'u', 'f', later, earlier, null).isActive(now)).toBe(false);
    });

    it('should not be active when rotated', () => {
      expect(Session.rehydrate('s', 'u', 'f', later, null, 'next').isActive(now)).toBe(false);
    });
  });

  describe('isRotated', () => {
    it('should report a session that has a successor', () => {
      expect(Session.rehydrate('s', 'u', 'f', later, earlier, 'next').isRotated()).toBe(true);
      expect(Session.rehydrate('s', 'u', 'f', later, null, null).isRotated()).toBe(false);
    });
  });
});
