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
  | 'platform_admin.deactivated'
  | 'role.created'
  | 'role.updated'
  | 'role.deactivated'
  | 'user.created'
  | 'user.updated'
  | 'user.activated'
  | 'user.deactivated'
  | 'user.password_reset'
  | 'user.permissions_updated'
  | 'branding.updated'
  | 'branding.asset_uploaded'
  | 'branding.asset_removed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'unit.created'
  | 'unit.updated'
  | 'unit.deleted'
  | 'department.created'
  | 'department.updated'
  | 'department.deactivated'
  | 'team.created'
  | 'team.updated'
  | 'team.deactivated'
  | 'team.member_added'
  | 'team.member_removed';

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
