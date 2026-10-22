import { Session } from '@domain/aggregates/SessionAggregate/Session';

import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface NewSession {
  readonly userId: string;
  readonly familyId: string;
  readonly refreshTokenHash: string;
  readonly expiresAt: Date;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export type RevokeReason = 'logout' | 'refresh_reuse' | 'password_changed';

export interface ISessionRepository {
  create(session: NewSession, tx?: Tx): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByTokenHash(hash: string): Promise<Session | null>;
  /**
   * Atomically replaces `currentId` with `next` (same family). Returns null when `currentId` was
   * no longer active, e.g. a concurrent refresh consumed it first.
   */
  rotate(currentId: string, next: NewSession): Promise<Session | null>;
  /** A login chain is alive while it has an unrevoked, unexpired session of this user. */
  isFamilyActive(familyId: string, userId: string): Promise<boolean>;
  revokeFamily(familyId: string, reason: RevokeReason): Promise<void>;
  revokeAllForUser(userId: string, reason: RevokeReason, tx?: Tx): Promise<void>;
}
