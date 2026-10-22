import { PageRequest } from '@shared/utils/Pagination';

export const AUDIT_QUERIES = Symbol('AUDIT_QUERIES');

export interface AuditRecordReadModel {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  actor: { id: string; email: string; name: string } | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ip: string | null;
}

export interface AuditListFilter extends PageRequest {
  action?: string;
  entityType?: string;
  organizationId?: string;
}

export interface IAuditQueries {
  findList(filter: AuditListFilter): Promise<{ rows: AuditRecordReadModel[]; total: number }>;
}
