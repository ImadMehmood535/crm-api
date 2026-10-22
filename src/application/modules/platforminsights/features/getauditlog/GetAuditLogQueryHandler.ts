import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  AUDIT_QUERIES,
  AuditRecordReadModel,
  IAuditQueries,
} from '@infrastructure/queries/abstraction/IAuditQueries';
import { requirePlatform } from '@application/common/Authorization';

import { GetAuditLogQuery } from './GetAuditLogQuery';

@QueryHandler(GetAuditLogQuery)
export class GetAuditLogQueryHandler implements IQueryHandler<
  GetAuditLogQuery,
  PagedResult<AuditRecordReadModel>
> {
  constructor(@Inject(AUDIT_QUERIES) private readonly audit: IAuditQueries) {}

  async execute(query: GetAuditLogQuery): Promise<PagedResult<AuditRecordReadModel>> {
    requirePlatform(query.actor);
    const { rows, total } = await this.audit.findList(query.filter);
    return PagedResult.of(rows, query.filter, total);
  }
}
