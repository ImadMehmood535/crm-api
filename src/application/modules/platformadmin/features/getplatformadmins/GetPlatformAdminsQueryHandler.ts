import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  IPlatformAdminQueries,
  PLATFORM_ADMIN_QUERIES,
  PlatformAdminReadModel,
} from '@infrastructure/queries/abstraction/IPlatformAdminQueries';
import { requirePlatform } from '@application/common/Authorization';

import { GetPlatformAdminsQuery } from './GetPlatformAdminsQuery';

@QueryHandler(GetPlatformAdminsQuery)
export class GetPlatformAdminsQueryHandler implements IQueryHandler<
  GetPlatformAdminsQuery,
  PagedResult<PlatformAdminReadModel>
> {
  constructor(@Inject(PLATFORM_ADMIN_QUERIES) private readonly admins: IPlatformAdminQueries) {}

  async execute(query: GetPlatformAdminsQuery): Promise<PagedResult<PlatformAdminReadModel>> {
    requirePlatform(query.actor);
    const { rows, total } = await this.admins.findList(query.page);
    return PagedResult.of(rows, query.page, total);
  }
}
