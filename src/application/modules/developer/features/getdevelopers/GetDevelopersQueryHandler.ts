import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  DEVELOPER_QUERIES,
  DeveloperReadModel,
  IDeveloperQueries,
} from '@infrastructure/queries/abstraction/IDeveloperQueries';
import { requirePlatform } from '@application/common/Authorization';

import { GetDevelopersQuery } from './GetDevelopersQuery';

@QueryHandler(GetDevelopersQuery)
export class GetDevelopersQueryHandler implements IQueryHandler<
  GetDevelopersQuery,
  PagedResult<DeveloperReadModel>
> {
  constructor(@Inject(DEVELOPER_QUERIES) private readonly developers: IDeveloperQueries) {}

  async execute(query: GetDevelopersQuery): Promise<PagedResult<DeveloperReadModel>> {
    requirePlatform(query.actor);
    const { rows, total } = await this.developers.findList(query.filter);
    return PagedResult.of(rows, query.filter, total);
  }
}
