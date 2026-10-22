import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  IOrgStructureQueries,
  ORG_STRUCTURE_QUERIES,
  TeamReadModel,
} from '@infrastructure/queries/abstraction/IOrgStructureQueries';
import { requirePermission, viewerOf } from '@application/common/Authorization';

import { GetTeamsQuery } from './GetTeamsQuery';

@QueryHandler(GetTeamsQuery)
export class GetTeamsQueryHandler implements IQueryHandler<
  GetTeamsQuery,
  PagedResult<TeamReadModel>
> {
  constructor(@Inject(ORG_STRUCTURE_QUERIES) private readonly org: IOrgStructureQueries) {}

  async execute(query: GetTeamsQuery): Promise<PagedResult<TeamReadModel>> {
    const organizationId = requirePermission(query.actor, 'teams.view');
    const { rows, total } = await this.org.findTeams({
      ...query.filter,
      organizationId,
      viewer: viewerOf(query.actor),
    });
    return PagedResult.of(rows, query.filter, total);
  }
}
