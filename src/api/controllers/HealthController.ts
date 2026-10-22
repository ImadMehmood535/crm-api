import { Controller, Get, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { CheckHealthQuery } from '@application/modules/health/features/checkhealth/CheckHealthQuery';
import { CheckHealthResponse } from '@application/modules/health/features/checkhealth/CheckHealthResponse';

import { RawResponse } from '../common/RawResponse';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @RawResponse()
  @ApiOperation({ summary: 'Liveness and database probe (unversioned, not enveloped)' })
  @ApiResponse({ status: 200, type: CheckHealthResponse })
  @ApiResponse({ status: 503, type: CheckHealthResponse })
  async check(@Res({ passthrough: true }) response: Response): Promise<CheckHealthResponse> {
    const health = await this.queryBus.execute<CheckHealthQuery, CheckHealthResponse>(
      new CheckHealthQuery(),
    );
    if (health.db === 'down') response.status(503);
    return health;
  }
}
