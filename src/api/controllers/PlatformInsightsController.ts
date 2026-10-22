import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { AuditRecordResponse } from '@application/modules/platforminsights/features/getauditlog/AuditRecordResponse';
import { GetAuditLogQuery } from '@application/modules/platforminsights/features/getauditlog/GetAuditLogQuery';
import { GetAuditLogRequest } from '@application/modules/platforminsights/features/getauditlog/GetAuditLogRequest';
import { GetPlatformStatsQuery } from '@application/modules/platforminsights/features/getplatformstats/GetPlatformStatsQuery';
import { GetPlatformStatsRequest } from '@application/modules/platforminsights/features/getplatformstats/GetPlatformStatsRequest';
import { PlatformStatsResponse } from '@application/modules/platforminsights/features/getplatformstats/PlatformStatsResponse';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { CurrentActor } from '../common/CurrentActor';

@ApiTags(SwaggerTag.PlatformInsights)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED (not a platform user)' })
@Controller(ApiRoute.Platform)
export class PlatformInsightsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard: counts, weekly trends, recent company activity' })
  @ApiResponse({ status: 200, type: PlatformStatsResponse })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (weeks 1-26)' })
  stats(
    @CurrentActor() actor: Actor,
    @Query() request: GetPlatformStatsRequest,
  ): Promise<PlatformStatsResponse> {
    return this.queryBus.execute(new GetPlatformStatsQuery(actor, request.weeks));
  }

  @Get('audit')
  @ApiOperation({ summary: 'Audit trail, newest first' })
  @ApiResponse({ status: 200, type: [AuditRecordResponse] })
  audit(
    @CurrentActor() actor: Actor,
    @Query() request: GetAuditLogRequest,
  ): Promise<PagedResult<AuditRecordResponse>> {
    return this.queryBus.execute(new GetAuditLogQuery(actor, request));
  }
}
