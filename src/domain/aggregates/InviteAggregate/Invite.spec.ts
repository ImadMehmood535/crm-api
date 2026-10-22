import { ConflictError, NotFoundError } from '@shared/errors/AppError';

import { Invite } from './Invite';

const NOW = new Date('2026-10-23T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const props = {
  email: ' New@Dev.Example.com',
  firstName: 'Ali',
  lastName: 'Raza',
  organizationName: 'Harbor Homes',
  slug: 'Harbor-Homes',
  tokenHash: 'h1',
  invitedBy: 'op-1',
};

describe('Invite', () => {
  describe('issue', () => {
    it('should be pending for 7 days with normalised email and slug', () => {
      const invite = Invite.issue(props, NOW);

      expect(invite.email).toBe('new@dev.example.com');
      expect(invite.slug).toBe('harbor-homes');
      expect(invite.status).toBe('pending');
      expect(invite.expiresAt.getTime() - NOW.getTime()).toBe(7 * DAY);
    });

    it('should report a short company name on organizationName', () => {
      expect(() => Invite.issue({ ...props, organizationName: 'A' }, NOW)).toThrow(
        expect.objectContaining({
          details: [expect.objectContaining({ field: 'organizationName' })],
        }) as Error,
      );
    });
  });

  describe('effectiveStatus', () => {
    it('should derive expired for a pending invite past its expiry', () => {
      const invite = Invite.issue(props, NOW);

      expect(invite.effectiveStatus(new Date(NOW.getTime() + 6 * DAY))).toBe('pending');
      expect(invite.effectiveStatus(new Date(NOW.getTime() + 8 * DAY))).toBe('expired');
      expect(invite.isLive(new Date(NOW.getTime() + 8 * DAY))).toBe(false);
    });
  });

  describe('renew', () => {
    it('should give an expired invite a new token and 7 more days', () => {
      const invite = Invite.issue(props, NOW);
      const later = new Date(NOW.getTime() + 10 * DAY);

      invite.renew('h2', later);

      expect(invite.tokenHash).toBe('h2');
      expect(invite.effectiveStatus(later)).toBe('pending');
    });

    it('should refuse an accepted invite with INVITE_NOT_PENDING', () => {
      const invite = Invite.issue(props, NOW);
      invite.accept(NOW);

      expect(() => invite.renew('h2', NOW)).toThrow(ConflictError);
      expect(() => invite.renew('h2', NOW)).toThrow(
        'This invite is accepted and cannot be resent.',
      );
    });
  });

  describe('revoke', () => {
    it('should revoke a pending invite once', () => {
      const invite = Invite.issue(props, NOW);

      invite.revoke();

      expect(invite.status).toBe('revoked');
      expect(() => invite.revoke()).toThrow(
        expect.objectContaining({ code: 'INVITE_NOT_PENDING' }) as Error,
      );
    });
  });

  describe('accept', () => {
    it('should accept a live invite', () => {
      const invite = Invite.issue(props, NOW);

      invite.accept(NOW);

      expect(invite.status).toBe('accepted');
      expect(invite.acceptedAt).toEqual(NOW);
    });

    it('should answer INVITE_INVALID for an expired invite', () => {
      const invite = Invite.issue(props, NOW);

      const act = (): void => invite.accept(new Date(NOW.getTime() + 8 * DAY));

      expect(act).toThrow(NotFoundError);
      expect(act).toThrow(expect.objectContaining({ code: 'INVITE_INVALID' }) as Error);
    });
  });
});
