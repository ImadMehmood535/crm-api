import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  IRbacQueries,
  RBAC_QUERIES,
  RoleReadModel,
} from '@infrastructure/queries/abstraction/IRbacQueries';
import { requirePermission } from '@application/common/Authorization';

import { GetRolesQuery } from './GetRolesQuery';

@QueryHandler(GetRolesQuery)
export class GetRolesQueryHandler implements IQueryHandler<
  GetRolesQuery,
  PagedResult<RoleReadModel>
> {
  constructor(@Inject(RBAC_QUERIES) private readonly rbac: IRbacQueries) {}

  async execute(query: GetRolesQuery): Promise<PagedResult<RoleReadModel>> {
    const organizationId = requirePermission(query.actor, 'roles.view');
    const { rows, total } = await this.rbac.findRoles({ ...query.filter, organizationId });
    return PagedResult.of(rows, query.filter, total);
  }
}
