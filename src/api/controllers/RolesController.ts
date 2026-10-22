import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { CreateRoleCommand } from '@application/modules/rbac/features/createrole/CreateRoleCommand';
import { CreateRoleRequest } from '@application/modules/rbac/features/createrole/CreateRoleRequest';
import { DeleteRoleCommand } from '@application/modules/rbac/features/deleterole/DeleteRoleCommand';
import { GetRolesQuery } from '@application/modules/rbac/features/getroles/GetRolesQuery';
import { GetRolesRequest } from '@application/modules/rbac/features/getroles/GetRolesRequest';
import { RoleResponse } from '@application/modules/rbac/features/getroles/RoleResponse';
import { UpdateRoleCommand } from '@application/modules/rbac/features/updaterole/UpdateRoleCommand';
import { UpdateRoleRequest } from '@application/modules/rbac/features/updaterole/UpdateRoleRequest';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.Roles)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
@Controller(ApiRoute.Roles)
export class RolesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: "The company's active roles, built-in first. Needs roles.view" })
  @ApiResponse({ status: 200, type: [RoleResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: GetRolesRequest,
  ): Promise<PagedResult<RoleResponse>> {
    return this.queryBus.execute(new GetRolesQuery(actor, request));
  }

  @Post()
  @ApiOperation({ summary: 'Create a role. Needs roles.create' })
  @ApiResponse({ status: 201, type: RoleResponse })
  @ApiResponse({ status: 403, description: 'PERMISSION_ESCALATION' })
  @ApiResponse({ status: 409, description: 'ROLE_NAME_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  create(
    @CurrentActor() actor: Actor,
    @Body() request: CreateRoleRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<RoleResponse> {
    return this.commandBus.execute(new CreateRoleCommand(actor, request, meta));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role (partial). Needs roles.edit' })
  @ApiResponse({ status: 200, type: RoleResponse })
  @ApiResponse({ status: 403, description: 'SYSTEM_ROLE_PROTECTED | PERMISSION_ESCALATION' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'ROLE_NAME_CONFLICT' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: UpdateRoleRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<RoleResponse> {
    return this.commandBus.execute(new UpdateRoleCommand(actor, id, request, meta));
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a role (removed from lists, no longer assignable). Needs roles.delete',
  })
  @ApiResponse({ status: 200, description: 'data: null' })
  @ApiResponse({ status: 403, description: 'SYSTEM_ROLE_PROTECTED | PERMISSION_ESCALATION' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'ROLE_IN_USE' })
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<null> {
    return this.commandBus.execute(new DeleteRoleCommand(actor, id, meta));
  }
}
