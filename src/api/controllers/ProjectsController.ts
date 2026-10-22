import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { CreateProjectCommand } from '@application/modules/project/features/createproject/CreateProjectCommand';
import {
  CreateProjectRequest,
  UpdateProjectRequest,
} from '@application/modules/project/features/createproject/ProjectRequest';
import { DeleteProjectCommand } from '@application/modules/project/features/deleteproject/DeleteProjectCommand';
import { GetProjectQuery } from '@application/modules/project/features/getproject/GetProjectQuery';
import { ProjectResponse } from '@application/modules/project/features/getproject/ProjectResponse';
import { GetProjectsQuery } from '@application/modules/project/features/getprojects/GetProjectsQuery';
import { GetProjectsRequest } from '@application/modules/project/features/getprojects/GetProjectsRequest';
import { UpdateProjectCommand } from '@application/modules/project/features/updateproject/UpdateProjectCommand';
import { CreateUnitCommand } from '@application/modules/unit/features/createunit/CreateUnitCommand';
import { CreateUnitRequest } from '@application/modules/unit/features/createunit/UnitRequest';
import { UnitResponse } from '@application/modules/unit/features/getunit/UnitResponse';
import { GetUnitsQuery } from '@application/modules/unit/features/getunits/GetUnitsQuery';
import { GetUnitsRequest } from '@application/modules/unit/features/getunits/GetUnitsRequest';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.Inventory)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
@Controller(ApiRoute.Projects)
export class ProjectsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    summary: "The company's projects with unit counts, newest first. Needs projects.view",
  })
  @ApiResponse({ status: 200, type: [ProjectResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: GetProjectsRequest,
  ): Promise<PagedResult<ProjectResponse>> {
    return this.queryBus.execute(new GetProjectsQuery(actor, request));
  }

  @Post()
  @ApiOperation({ summary: 'Create a project. Needs projects.create' })
  @ApiResponse({ status: 201, type: ProjectResponse })
  @ApiResponse({ status: 409, description: 'PROJECT_NAME_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  create(
    @CurrentActor() actor: Actor,
    @Body() request: CreateProjectRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<ProjectResponse> {
    return this.commandBus.execute(new CreateProjectCommand(actor, request, meta));
  }

  @Get(':id')
  @ApiOperation({ summary: 'One project. Needs projects.view' })
  @ApiResponse({ status: 200, type: ProjectResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<ProjectResponse> {
    return this.queryBus.execute(new GetProjectQuery(actor, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (partial; null clears). Needs projects.edit' })
  @ApiResponse({ status: 200, type: ProjectResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PROJECT_NAME_CONFLICT' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: UpdateProjectRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<ProjectResponse> {
    return this.commandBus.execute(new UpdateProjectCommand(actor, id, request, meta));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project without units. Needs projects.delete' })
  @ApiResponse({ status: 200, description: 'data: null' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PROJECT_HAS_UNITS' })
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<null> {
    return this.commandBus.execute(new DeleteProjectCommand(actor, id, meta));
  }

  @Get(':id/units')
  @ApiTags(SwaggerTag.Inventory)
  @ApiOperation({ summary: "A project's units in natural order. Needs units.view" })
  @ApiResponse({ status: 200, type: [UnitResponse] })
  @ApiResponse({ status: 404, description: 'NOT_FOUND (project)' })
  findUnits(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Query() request: GetUnitsRequest,
  ): Promise<PagedResult<UnitResponse>> {
    return this.queryBus.execute(new GetUnitsQuery(actor, id, request));
  }

  @Post(':id/units')
  @ApiOperation({ summary: 'Add a unit to a project. Needs units.create' })
  @ApiResponse({ status: 201, type: UnitResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND (project)' })
  @ApiResponse({ status: 409, description: 'UNIT_NUMBER_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  createUnit(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: CreateUnitRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<UnitResponse> {
    return this.commandBus.execute(new CreateUnitCommand(actor, id, request, meta));
  }
}
