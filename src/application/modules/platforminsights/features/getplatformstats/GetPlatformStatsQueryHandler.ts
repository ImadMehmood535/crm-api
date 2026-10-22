import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  IPlatformStatsQueries,
  PLATFORM_STATS_QUERIES,
} from '@infrastructure/queries/abstraction/IPlatformStatsQueries';
import { requirePlatform } from '@application/common/Authorization';

import { GetPlatformStatsQuery } from './GetPlatformStatsQuery';
import { PlatformStatsResponse } from './PlatformStatsResponse';

@QueryHandler(GetPlatformStatsQuery)
export class GetPlatformStatsQueryHandler implements IQueryHandler<
  GetPlatformStatsQuery,
  PlatformStatsResponse
> {
  constructor(@Inject(PLATFORM_STATS_QUERIES) private readonly stats: IPlatformStatsQueries) {}

  async execute(query: GetPlatformStatsQuery): Promise<PlatformStatsResponse> {
    requirePlatform(query.actor);
    return PlatformStatsResponse.from(await this.stats.getStats(query.weeks));
  }
}
