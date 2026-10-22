import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { AuthUserResponse } from '@application/modules/auth/features/getme/AuthUserResponse';
import { GetMeQuery } from '@application/modules/auth/features/getme/GetMeQuery';
import { AuthSessionResponse } from '@application/modules/auth/features/login/AuthSessionResponse';
import { LoginCommand } from '@application/modules/auth/features/login/LoginCommand';
import { LoginRequest } from '@application/modules/auth/features/login/LoginRequest';
import { LogoutCommand } from '@application/modules/auth/features/logout/LogoutCommand';
import { RefreshCommand } from '@application/modules/auth/features/refresh/RefreshCommand';
import { RefreshRequest } from '@application/modules/auth/features/refresh/RefreshRequest';
import { ResetPasswordCommand } from '@application/modules/auth/features/resetpassword/ResetPasswordCommand';
import { ResetPasswordRequest } from '@application/modules/auth/features/resetpassword/ResetPasswordRequest';

import { AllowWhenResetRequired } from '../common/AllowWhenResetRequired';
import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { Public } from '../common/Public';

@ApiTags(SwaggerTag.Auth)
@Controller(ApiRoute.Auth)
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, type: AuthSessionResponse })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'ORGANIZATION_SUSPENDED | ACCOUNT_INACTIVE' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  login(
    @Body() request: LoginRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<AuthSessionResponse> {
    return this.commandBus.execute(new LoginCommand(request.email, request.password, meta));
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a refresh token for a new session (rotates the token)' })
  @ApiResponse({ status: 200, type: AuthSessionResponse })
  @ApiResponse({
    status: 401,
    description: 'UNAUTHENTICATED (unknown, expired, revoked or reused)',
  })
  @ApiResponse({ status: 403, description: 'ORGANIZATION_SUSPENDED | ACCOUNT_INACTIVE' })
  refresh(
    @Body() request: RefreshRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<AuthSessionResponse> {
    return this.commandBus.execute(new RefreshCommand(request.refreshToken, meta));
  }

  @Post('logout')
  @HttpCode(200)
  @AllowWhenResetRequired()
  @ApiBearerAuth()
  @ApiOperation({ summary: "End the caller's login chain" })
  @ApiResponse({ status: 200, description: 'data: null' })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
  logout(@CurrentActor() actor: Actor): Promise<null> {
    return this.commandBus.execute(new LogoutCommand(actor));
  }

  @Post('reset-password')
  @HttpCode(200)
  @AllowWhenResetRequired()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a new password; revokes every session and returns a new one' })
  @ApiResponse({ status: 200, type: AuthSessionResponse })
  @ApiResponse({
    status: 401,
    description: 'INVALID_CREDENTIALS (current password) | UNAUTHENTICATED',
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (newPassword)' })
  resetPassword(
    @CurrentActor() actor: Actor,
    @Body() request: ResetPasswordRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<AuthSessionResponse> {
    return this.commandBus.execute(
      new ResetPasswordCommand(actor, request.currentPassword, request.newPassword, meta),
    );
  }

  @Get('me')
  @AllowWhenResetRequired()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiResponse({ status: 200, type: AuthUserResponse })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
  me(@CurrentActor() actor: Actor): Promise<AuthUserResponse> {
    return this.queryBus.execute(new GetMeQuery(actor));
  }
}
