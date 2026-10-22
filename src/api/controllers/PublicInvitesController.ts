import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RequestMeta } from '@shared/auth/Actor';
import { AuthSessionResponse } from '@application/modules/auth/features/login/AuthSessionResponse';
import { AcceptInviteCommand } from '@application/modules/invite/features/acceptinvite/AcceptInviteCommand';
import { AcceptInviteRequest } from '@application/modules/invite/features/acceptinvite/AcceptInviteRequest';
import { InvitePreviewResponse } from '@application/modules/invite/features/previewinvite/InvitePreviewResponse';
import { PreviewInviteQuery } from '@application/modules/invite/features/previewinvite/PreviewInviteQuery';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { Public } from '../common/Public';

@ApiTags(SwaggerTag.PublicInvites)
@Public()
@Controller(ApiRoute.PublicInvites)
export class PublicInvitesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview a live invite' })
  @ApiResponse({ status: 200, type: InvitePreviewResponse })
  @ApiResponse({ status: 404, description: 'INVITE_INVALID (unknown, expired, used or revoked)' })
  preview(@Param('token') token: string): Promise<InvitePreviewResponse> {
    return this.queryBus.execute(new PreviewInviteQuery(token));
  }

  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Accept an invite: creates the company and its owner, and signs the owner in',
  })
  @ApiResponse({ status: 200, type: AuthSessionResponse })
  @ApiResponse({ status: 404, description: 'INVITE_INVALID' })
  @ApiResponse({ status: 409, description: 'SLUG_CONFLICT | EMAIL_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  accept(
    @Param('token') token: string,
    @Body() request: AcceptInviteRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<AuthSessionResponse> {
    return this.commandBus.execute(new AcceptInviteCommand(token, request, meta));
  }
}
