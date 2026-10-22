import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  DepartmentReadModel,
  IOrgStructureQueries,
  ORG_STRUCTURE_QUERIES,
} from '@infrastructure/queries/abstraction/IOrgStructureQueries';
import { requirePermission, viewerOf } from '@application/common/Authorization';

import { GetDepartmentsQuery } from './GetDepartmentsQuery';

@QueryHandler(GetDepartmentsQuery)
export class GetDepartmentsQueryHandler implements IQueryHandler<
  GetDepartmentsQuery,
  PagedResult<DepartmentReadModel>
> {
  constructor(@Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries) {}

  async execute(query: GetDepartmentsQuery): Promise<PagedResult<DepartmentReadModel>> {
    const organizationId = requirePermission(query.actor, 'departments.view');
    const { rows, total } = await this.org.findDepartments({
      page: query.filter.page,
      pageSize: query.filter.pageSize,
      organizationId,
      viewer: viewerOf(query.actor),
    });
    return PagedResult.of(rows, query.filter, total);
  }
}
