import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { AuditLogModel } from '@domain/aggregates/AuditAggregate/AuditLogModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { AuditEntry, IAuditLog } from './abstraction/IAuditLog';

const SECRET_KEY = /password|token|hash|secret/i;
const IP_MAX = 64;

/** Drops any key that looks like a secret, at any depth. */
export function redact(
  values: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!values) return null;
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, value]) => [
        key,
        value && typeof value === 'object' && !Array.isArray(value)
          ? redact(value as Record<string, unknown>)
          : value,
      ]),
  );
}

@Injectable()
export class AuditLog implements IAuditLog {
  constructor(@InjectModel(AuditLogModel) private readonly auditModel: typeof AuditLogModel) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    await this.auditModel.create(
      {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        organizationId: entry.organizationId,
        oldValues: redact(entry.oldValues),
        newValues: redact(entry.newValues),
        ip: entry.ip?.slice(0, IP_MAX) ?? null,
      },
      { transaction: tx as Transaction },
    );
  }
}
