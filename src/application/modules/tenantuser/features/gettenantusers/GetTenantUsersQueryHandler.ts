import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
  TenantUserReadModel,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import { requirePermission, viewerOf } from '@application/common/Authorization';

import { GetTenantUsersQuery } from './GetTenantUsersQuery';

@QueryHandler(GetTenantUsersQuery)
export class GetTenantUsersQueryHandler implements IQueryHandler<
  GetTenantUsersQuery,
  PagedResult<TenantUserReadModel>
> {
  constructor(@Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries) {}

  async execute(query: GetTenantUsersQuery): Promise<PagedResult<TenantUserReadModel>> {
    const organizationId = requirePermission(query.actor, 'users.view');
    const { rows, total } = await this.tenantUsers.findList({
      ...query.filter,
      organizationId,
      viewer: viewerOf(query.actor),
    });
    return PagedResult.of(rows, query.filter, total);
  }
}
