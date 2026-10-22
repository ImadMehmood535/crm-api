import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotFoundError } from '@shared/errors/AppError';
import { PagedResult } from '@shared/utils/Pagination';
import {
  IInventoryQueries,
  INVENTORY_QUERIES,
  UnitReadModel,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import { requirePermission } from '@application/common/Authorization';

import { GetUnitsQuery } from './GetUnitsQuery';

@QueryHandler(GetUnitsQuery)
export class GetUnitsQueryHandler implements IQueryHandler<
  GetUnitsQuery,
  PagedResult<UnitReadModel>
> {
  constructor(@Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries) {}

  async execute(query: GetUnitsQuery): Promise<PagedResult<UnitReadModel>> {
    const organizationId = requirePermission(query.actor, 'units.view');
    if (!(await this.inventory.findProject(organizationId, query.projectId))) {
      throw new NotFoundError('Project not found.');
    }
    const { rows, total } = await this.inventory.findUnits({
      ...query.filter,
      organizationId,
      projectId: query.projectId,
    });
    return PagedResult.of(rows, query.filter, total);
  }
}
