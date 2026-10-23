import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { ChangeTenantUserStatusCommand } from '@application/modules/tenantuser/features/changetenantuserstatus/ChangeTenantUserStatusCommand';
import { CreateTenantUserCommand } from '@application/modules/tenantuser/features/createtenantuser/CreateTenantUserCommand';
import { CreateTenantUserRequest } from '@application/modules/tenantuser/features/createtenantuser/CreateTenantUserRequest';
import { GetTenantUserQuery } from '@application/modules/tenantuser/features/gettenantuser/GetTenantUserQuery';
import {
  TenantUserResponse,
  TenantUserWithPasswordResponse,
} from '@application/modules/tenantuser/features/gettenantuser/TenantUserResponse';
import { GetUserPermissionsQuery } from '@application/modules/tenantuser/features/getuserpermissions/GetUserPermissionsQuery';
import { UserPermissionsResponse } from '@application/modules/tenantuser/features/getuserpermissions/UserPermissionsResponse';
import { SetUserPermissionsCommand } from '@application/modules/tenantuser/features/setuserpermissions/SetUserPermissionsCommand';
import { SetUserPermissionsRequest } from '@application/modules/tenantuser/features/setuserpermissions/SetUserPermissionsRequest';
import { GetTenantUsersQuery } from '@application/modules/tenantuser/features/gettenantusers/GetTenantUsersQuery';
import { GetTenantUsersRequest } from '@application/modules/tenantuser/features/gettenantusers/GetTenantUsersRequest';
import { ResetTenantUserPasswordCommand } from '@application/modules/tenantuser/features/resettenantuserpassword/ResetTenantUserPasswordCommand';
import { UpdateTenantUserCommand } from '@application/modules/tenantuser/features/updatetenantuser/UpdateTenantUserCommand';
import { UpdateTenantUserRequest } from '@application/modules/tenantuser/features/updatetenantuser/UpdateTenantUserRequest';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.Users)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
@Controller(ApiRoute.Users)
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: "The company's users (search, status). Needs users.view" })
  @ApiResponse({ status: 200, type: [TenantUserResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: GetTenantUsersRequest,
  ): Promise<PagedResult<TenantUserResponse>> {
    return this.queryBus.execute(new GetTenantUsersQuery(actor, request));
  }

  @Post()
  @ApiOperation({
    summary: 'Add a user with roles and a one-time temporary password. Needs users.create',
  })
  @ApiResponse({ status: 201, type: TenantUserWithPasswordResponse })
  @ApiResponse({ status: 403, description: 'SYSTEM_ROLE_PROTECTED | PERMISSION_ESCALATION' })
  @ApiResponse({ status: 409, description: 'EMAIL_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (roleIds, …)' })
  create(
    @CurrentActor() actor: Actor,
    @Body() request: CreateTenantUserRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TenantUserWithPasswordResponse> {
    return this.commandBus.execute(new CreateTenantUserCommand(actor, request, meta));
  }

  @Get(':id')
  @ApiOperation({ summary: 'One user of the company. Needs users.view' })
  @ApiResponse({ status: 200, type: TenantUserResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TenantUserResponse> {
    return this.queryBus.execute(new GetTenantUserQuery(actor, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update names and roles (partial). Needs users.edit' })
  @ApiResponse({ status: 200, type: TenantUserResponse })
  @ApiResponse({
    status: 403,
    description: 'FORBIDDEN_OPERATION | SYSTEM_ROLE_PROTECTED | PERMISSION_ESCALATION',
  })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: UpdateTenantUserRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TenantUserResponse> {
    return this.commandBus.execute(new UpdateTenantUserCommand(actor, id, request, meta));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a user (sessions revoked). Needs users.deactivate' })
  @ApiResponse({ status: 200, type: TenantUserResponse })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OPERATION | PERMISSION_ESCALATION' })
  deactivate(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TenantUserResponse> {
    return this.commandBus.execute(
      new ChangeTenantUserStatusCommand(actor, id, 'deactivate', meta),
    );
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reactivate a user. Needs users.deactivate' })
  @ApiResponse({ status: 200, type: TenantUserResponse })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OPERATION | PERMISSION_ESCALATION' })
  activate(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TenantUserResponse> {
    return this.commandBus.execute(new ChangeTenantUserStatusCommand(actor, id, 'activate', meta));
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: "Reset a user's password to a one-time temporary password. Needs users.edit",
  })
  @ApiResponse({ status: 200, type: TenantUserWithPasswordResponse })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OPERATION | PERMISSION_ESCALATION' })
  resetPassword(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<TenantUserWithPasswordResponse> {
    return this.commandBus.execute(new ResetTenantUserPasswordCommand(actor, id, meta));
  }

  @Get(':id/permissions')
  @ApiOperation({
    summary:
      "A user's permissions by source (roles, granted, revoked, effective). Needs users.view",
  })
  @ApiResponse({ status: 200, type: UserPermissionsResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  findPermissions(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<UserPermissionsResponse> {
    return this.queryBus.execute(new GetUserPermissionsQuery(actor, id));
  }

  @Put(':id/permissions')
  @ApiOperation({
    summary:
      "Set one user's effective permissions (stored as overrides on top of their roles). Needs users.edit",
  })
  @ApiResponse({ status: 200, type: UserPermissionsResponse })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OPERATION | PERMISSION_ESCALATION' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  setPermissions(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: SetUserPermissionsRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<UserPermissionsResponse> {
    return this.commandBus.execute(
      new SetUserPermissionsCommand(actor, id, request.permissions, meta),
    );
  }
}
