import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor } from '@shared/auth/Actor';
import { GetPermissionsQuery } from '@application/modules/rbac/features/getpermissions/GetPermissionsQuery';
import { PermissionModuleResponse } from '@application/modules/rbac/features/getpermissions/PermissionModuleResponse';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { CurrentActor } from '../common/CurrentActor';

@ApiTags(SwaggerTag.Roles)
@ApiBearerAuth()
@Controller(ApiRoute.Permissions)
export class PermissionsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'The permission catalogue (matrix rows and columns). Needs roles.view' })
  @ApiResponse({ status: 200, type: [PermissionModuleResponse] })
  @ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
  findAll(@CurrentActor() actor: Actor): Promise<PermissionModuleResponse[]> {
    return this.queryBus.execute(new GetPermissionsQuery(actor));
  }
}
