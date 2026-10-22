import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const AUDIT_LOG = Symbol('AUDIT_LOG');

export type AuditAction =
  | 'developer.onboarded'
  | 'developer.suspended'
  | 'developer.reactivated'
  | 'invite.issued'
  | 'invite.resent'
  | 'invite.revoked'
  | 'invite.accepted'
  | 'platform_admin.created'
  | 'platform_admin.deactivated';

export interface AuditEntry {
  readonly actorUserId: string | null;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly organizationId: string | null;
  readonly oldValues?: Record<string, unknown> | null;
  readonly newValues?: Record<string, unknown> | null;
  readonly ip: string | null;
}

export interface IAuditLog {
  /** Appends one entry. Values are redacted: secrets never reach the table. */
  record(entry: AuditEntry, tx?: Tx): Promise<void>;
}
