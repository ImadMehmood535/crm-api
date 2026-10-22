import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { PagedResult } from '@shared/utils/Pagination';
import { GetInvitesQuery } from '@application/modules/invite/features/getinvites/GetInvitesQuery';
import { GetInvitesRequest } from '@application/modules/invite/features/getinvites/GetInvitesRequest';
import { InviteResponse } from '@application/modules/invite/features/getinvites/InviteResponse';
import { IssueInviteCommand } from '@application/modules/invite/features/issueinvite/IssueInviteCommand';
import { IssueInviteRequest } from '@application/modules/invite/features/issueinvite/IssueInviteRequest';
import { ResendInviteCommand } from '@application/modules/invite/features/resendinvite/ResendInviteCommand';
import { RevokeInviteCommand } from '@application/modules/invite/features/revokeinvite/RevokeInviteCommand';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

@ApiTags(SwaggerTag.PlatformInvites)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED (not a platform user)' })
@Controller(ApiRoute.PlatformInvites)
export class PlatformInvitesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List invites (status filter; expired is derived)' })
  @ApiResponse({ status: 200, type: [InviteResponse] })
  findAll(
    @CurrentActor() actor: Actor,
    @Query() request: GetInvitesRequest,
  ): Promise<PagedResult<InviteResponse>> {
    return this.queryBus.execute(new GetInvitesQuery(actor, request));
  }

  @Post()
  @ApiOperation({ summary: 'Invite a developer company by e-mail' })
  @ApiResponse({ status: 201, type: InviteResponse })
  @ApiResponse({ status: 409, description: 'SLUG_CONFLICT | EMAIL_CONFLICT | INVITE_PENDING' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED | SLUG_RESERVED' })
  issue(
    @CurrentActor() actor: Actor,
    @Body() request: IssueInviteRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<InviteResponse> {
    return this.commandBus.execute(new IssueInviteCommand(actor, request, meta));
  }

  @Post(':id/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend a pending or expired invite (new link, 7 more days)' })
  @ApiResponse({ status: 200, type: InviteResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'INVITE_NOT_PENDING' })
  resend(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<InviteResponse> {
    return this.commandBus.execute(new ResendInviteCommand(actor, id, meta));
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a pending invite' })
  @ApiResponse({ status: 200, type: InviteResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'INVITE_NOT_PENDING' })
  revoke(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUuidPipe) id: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<InviteResponse> {
    return this.commandBus.execute(new RevokeInviteCommand(actor, id, meta));
  }
}
