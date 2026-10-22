import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { UpdateUnitRequest } from '@application/modules/unit/features/createunit/UnitRequest';
import { DeleteUnitCommand } from '@application/modules/unit/features/deleteunit/DeleteUnitCommand';
import { GetUnitQuery } from '@application/modules/unit/features/getunit/GetUnitQuery';
import { UnitResponse } from '@application/modules/unit/features/getunit/UnitResponse';
import { UpdateUnitCommand } from '@application/modules/unit/features/updateunit/UpdateUnitCommand';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.Inventory)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
@Controller(ApiRoute.Units)
export class UnitsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'One unit. Needs units.view' })
  @ApiResponse({ status: 200, type: UnitResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<UnitResponse> {
    return this.queryBus.execute(new GetUnitQuery(actor, id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a unit (partial; null clears; never moves projects). Needs units.edit',
  })
  @ApiResponse({ status: 200, type: UnitResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'UNIT_NUMBER_CONFLICT' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @Body() request: UpdateUnitRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<UnitResponse> {
    return this.commandBus.execute(new UpdateUnitCommand(actor, id, request, meta));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a unit. Needs units.delete' })
  @ApiResponse({ status: 200, description: 'data: null' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<null> {
    return this.commandBus.execute(new DeleteUnitCommand(actor, id, meta));
  }
}
