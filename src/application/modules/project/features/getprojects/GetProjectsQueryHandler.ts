import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  IInventoryQueries,
  INVENTORY_QUERIES,
  ProjectReadModel,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import { requirePermission } from '@application/common/Authorization';

import { GetProjectsQuery } from './GetProjectsQuery';

@QueryHandler(GetProjectsQuery)
export class GetProjectsQueryHandler implements IQueryHandler<
  GetProjectsQuery,
  PagedResult<ProjectReadModel>
> {
  constructor(@Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries) {}

  async execute(query: GetProjectsQuery): Promise<PagedResult<ProjectReadModel>> {
    const organizationId = requirePermission(query.actor, 'projects.view');
    const { rows, total } = await this.inventory.findProjects({ ...query.filter, organizationId });
    return PagedResult.of(rows, query.filter, total);
  }
}
