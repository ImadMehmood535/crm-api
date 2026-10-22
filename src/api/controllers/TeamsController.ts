import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { AddTeamMemberCommand } from '@application/modules/orgstructure/features/addteammember/AddTeamMemberCommand';
import { CreateTeamCommand } from '@application/modules/orgstructure/features/createteam/CreateTeamCommand';
import {
  AddTeamMemberRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
} from '@application/modules/orgstructure/features/createteam/TeamRequest';
import { DeleteTeamCommand } from '@application/modules/orgstructure/features/deleteteam/DeleteTeamCommand';
import { GetTeamsQuery } from '@application/modules/orgstructure/features/getteams/GetTeamsQuery';
import { GetTeamsRequest } from '@application/modules/orgstructure/features/getteams/GetTeamsRequest';
import { TeamResponse } from '@application/modules/orgstructure/features/getteams/TeamResponse';
import { RemoveTeamMemberCommand } from '@application/modules/orgstructure/features/removeteammember/RemoveTeamMemberCommand';
import { UpdateTeamCommand } from '@application/modules/orgstructure/features/updateteam/UpdateTeamCommand';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.OrgStructure)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED | FORBIDDEN_OPERATION' })
@Controller(ApiRoute.Teams)
export class TeamsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Active teams the caller may see, by name. Needs teams.view' })
  @ApiResponse({ status: 200, type: [TeamResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: GetTeamsRequest,
  ): Promise<PagedResult<TeamResponse>> {
    return this.queryBus.execute(new GetTeamsQuery(actor, request));
  }

  @Post()
  @ApiOperation({ summary: 'Create a team in a department the caller manages. Needs teams.create' })
  @ApiResponse({ status: 201, type: TeamResponse })
  @ApiResponse({ status: 409, description: 'TEAM_NAME_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  create(
    @CurrentActor() actor: Actor,
    @Body() request: CreateTeamRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TeamResponse> {
    return this.commandBus.execute(new CreateTeamCommand(actor, request, meta));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a team. Needs teams.edit' })
  @ApiResponse({ status: 200, type: TeamResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'TEAM_NAME_CONFLICT' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: UpdateTeamRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TeamResponse> {
    return this.commandBus.execute(new UpdateTeamCommand(actor, id, request, meta));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a team without members. Needs teams.delete' })
  @ApiResponse({ status: 200, description: 'data: null' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'TEAM_HAS_MEMBERS' })
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<null> {
    return this.commandBus.execute(new DeleteTeamCommand(actor, id, meta));
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member (idempotent). Needs teams.edit' })
  @ApiResponse({ status: 201, type: TeamResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  addMember(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: AddTeamMemberRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TeamResponse> {
    return this.commandBus.execute(new AddTeamMemberCommand(actor, id, request.userId, meta));
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member. Needs teams.edit' })
  @ApiResponse({ status: 200, type: TeamResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  removeMember(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Param('userId', ParseUuidPipe) userId: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TeamResponse> {
    return this.commandBus.execute(new RemoveTeamMemberCommand(actor, id, userId, meta));
  }
}
