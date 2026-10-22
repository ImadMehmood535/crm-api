import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { PageQuery } from '@application/common/PageQuery';
import { CreateDepartmentCommand } from '@application/modules/orgstructure/features/createdepartment/CreateDepartmentCommand';
import {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '@application/modules/orgstructure/features/createdepartment/DepartmentRequest';
import { DeleteDepartmentCommand } from '@application/modules/orgstructure/features/deletedepartment/DeleteDepartmentCommand';
import { DepartmentResponse } from '@application/modules/orgstructure/features/getdepartments/DepartmentResponse';
import { GetDepartmentsQuery } from '@application/modules/orgstructure/features/getdepartments/GetDepartmentsQuery';
import { UpdateDepartmentCommand } from '@application/modules/orgstructure/features/updatedepartment/UpdateDepartmentCommand';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.OrgStructure)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED | FORBIDDEN_OPERATION' })
@Controller(ApiRoute.Departments)
export class DepartmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Active departments the caller may see, by name. Needs departments.view',
  })
  @ApiResponse({ status: 200, type: [DepartmentResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: PageQuery,
  ): Promise<PagedResult<DepartmentResponse>> {
    return this.queryBus.execute(new GetDepartmentsQuery(actor, request));
  }

  @Post()
  @ApiOperation({ summary: 'Create a department (owners and admins). Needs departments.create' })
  @ApiResponse({ status: 201, type: DepartmentResponse })
  @ApiResponse({ status: 409, description: 'DEPARTMENT_NAME_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  create(
    @CurrentActor() actor: Actor,
    @Body() request: CreateDepartmentRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<DepartmentResponse> {
    return this.commandBus.execute(new CreateDepartmentCommand(actor, request, meta));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or change the head (null removes it). Needs departments.edit' })
  @ApiResponse({ status: 200, type: DepartmentResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DEPARTMENT_NAME_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: UpdateDepartmentRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<DepartmentResponse> {
    return this.commandBus.execute(new UpdateDepartmentCommand(actor, id, request, meta));
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a department without active teams. Needs departments.delete',
  })
  @ApiResponse({ status: 200, description: 'data: null' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DEPARTMENT_HAS_TEAMS' })
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<null> {
    return this.commandBus.execute(new DeleteDepartmentCommand(actor, id, meta));
  }
}
