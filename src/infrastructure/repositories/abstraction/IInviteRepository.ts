import { Invite } from '@domain/aggregates/InviteAggregate/Invite';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const INVITE_REPOSITORY = Symbol('INVITE_REPOSITORY');

export interface IInviteRepository {
  save(invite: Invite, tx?: Tx): Promise<Invite>;
  update(invite: Invite, tx?: Tx): Promise<void>;
  findById(id: string): Promise<Invite | null>;
  /** With a transaction the row is locked (FOR UPDATE), so two acceptances cannot both win. */
  findByTokenHash(tokenHash: string, tx?: Tx): Promise<Invite | null>;
  livePendingEmailExists(email: string): Promise<boolean>;
  livePendingSlugExists(slug: string, exceptInviteId?: string): Promise<boolean>;
}
