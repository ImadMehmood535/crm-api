import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { ChangeDeveloperStatusCommand } from '@application/modules/developer/features/changedeveloperstatus/ChangeDeveloperStatusCommand';
import { DeveloperResponse } from '@application/modules/developer/features/getdeveloper/DeveloperResponse';
import { GetDeveloperQuery } from '@application/modules/developer/features/getdeveloper/GetDeveloperQuery';
import { GetDevelopersQuery } from '@application/modules/developer/features/getdevelopers/GetDevelopersQuery';
import { GetDevelopersRequest } from '@application/modules/developer/features/getdevelopers/GetDevelopersRequest';
import { OnboardDeveloperCommand } from '@application/modules/developer/features/onboarddeveloper/OnboardDeveloperCommand';
import { OnboardDeveloperRequest } from '@application/modules/developer/features/onboarddeveloper/OnboardDeveloperRequest';
import { OnboardDeveloperResponse } from '@application/modules/developer/features/onboarddeveloper/OnboardDeveloperResponse';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.PlatformDevelopers)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED (not a platform user)' })
@Controller(ApiRoute.PlatformDevelopers)
export class PlatformDevelopersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List developer companies (search, status, pagination; newest first)' })
  @ApiResponse({ status: 200, type: [DeveloperResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: GetDevelopersRequest,
  ): Promise<PagedResult<DeveloperResponse>> {
    return this.queryBus.execute(new GetDevelopersQuery(actor, request));
  }

  @Post()
  @ApiOperation({ summary: 'Onboard a company with its owner (one-time temporary password)' })
  @ApiResponse({ status: 201, type: OnboardDeveloperResponse })
  @ApiResponse({ status: 409, description: 'SLUG_CONFLICT | EMAIL_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED | SLUG_RESERVED' })
  onboard(
    @CurrentActor() actor: Actor,
    @Body() request: OnboardDeveloperRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<OnboardDeveloperResponse> {
    return this.commandBus.execute(
      new OnboardDeveloperCommand(actor, request.name, request.slug, request.superUser, meta),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'One developer company' })
  @ApiResponse({ status: 200, type: DeveloperResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<DeveloperResponse> {
    return this.queryBus.execute(new GetDeveloperQuery(actor, id));
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suspend a company (its users are locked out on their next request)' })
  @ApiResponse({ status: 200, type: DeveloperResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  suspend(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<DeveloperResponse> {
    return this.commandBus.execute(new ChangeDeveloperStatusCommand(actor, id, 'suspend', meta));
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reactivate a suspended company' })
  @ApiResponse({ status: 200, type: DeveloperResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  reactivate(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<DeveloperResponse> {
    return this.commandBus.execute(new ChangeDeveloperStatusCommand(actor, id, 'reactivate', meta));
  }
}
