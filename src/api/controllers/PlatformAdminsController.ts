import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { PageQuery } from '@application/common/PageQuery';
import { CreatePlatformAdminCommand } from '@application/modules/platformadmin/features/createplatformadmin/CreatePlatformAdminCommand';
import { CreatePlatformAdminRequest } from '@application/modules/platformadmin/features/createplatformadmin/CreatePlatformAdminRequest';
import { CreatePlatformAdminResponse } from '@application/modules/platformadmin/features/createplatformadmin/CreatePlatformAdminResponse';
import { DeactivatePlatformAdminCommand } from '@application/modules/platformadmin/features/deactivateplatformadmin/DeactivatePlatformAdminCommand';
import { GetPlatformAdminsQuery } from '@application/modules/platformadmin/features/getplatformadmins/GetPlatformAdminsQuery';
import { PlatformAdminResponse } from '@application/modules/platformadmin/features/getplatformadmins/PlatformAdminResponse';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.PlatformAdmins)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
@Controller(ApiRoute.PlatformAdmins)
export class PlatformAdminsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List platform operators (active and inactive)' })
  @ApiResponse({ status: 200, type: [PlatformAdminResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() page: PageQuery,
  ): Promise<PagedResult<PlatformAdminResponse>> {
    return this.queryBus.execute(new GetPlatformAdminsQuery(actor, page));
  }

  @Post()
  @ApiOperation({ summary: 'Create a platform admin (platform super user only)' })
  @ApiResponse({ status: 201, type: CreatePlatformAdminResponse })
  @ApiResponse({ status: 409, description: 'EMAIL_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  create(
    @CurrentActor() actor: Actor,
    @Body() request: CreatePlatformAdminRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<CreatePlatformAdminResponse> {
    return this.commandBus.execute(new CreatePlatformAdminCommand(actor, request, meta));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a platform admin (platform super user only)' })
  @ApiResponse({ status: 200, type: PlatformAdminResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'LAST_SUPER_USER' })
  deactivate(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<PlatformAdminResponse> {
    return this.commandBus.execute(new DeactivatePlatformAdminCommand(actor, id, meta));
  }
}
