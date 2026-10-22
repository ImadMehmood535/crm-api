import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotFoundError } from '@shared/errors/AppError';
import {
  DEVELOPER_QUERIES,
  IDeveloperQueries,
} from '@infrastructure/queries/abstraction/IDeveloperQueries';
import { requirePlatform } from '@application/common/Authorization';

import { DeveloperResponse } from './DeveloperResponse';
import { GetDeveloperQuery } from './GetDeveloperQuery';

export const developerNotFound = (): NotFoundError => new NotFoundError('Developer not found.');

@QueryHandler(GetDeveloperQuery)
export class GetDeveloperQueryHandler implements IQueryHandler<
  GetDeveloperQuery,
  DeveloperResponse
> {
  constructor(@Inject(DEVELOPER_QUERIES) private readonly developers: IDeveloperQueries) {}

  async execute(query: GetDeveloperQuery): Promise<DeveloperResponse> {
    requirePlatform(query.actor);
    const developer = await this.developers.findById(query.id);
    if (!developer) throw developerNotFound();
    return DeveloperResponse.from(developer);
  }
}
