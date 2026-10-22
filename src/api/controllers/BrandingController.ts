import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Actor, RequestMeta } from '@shared/auth/Actor';
import { BrandingResponse } from '@application/modules/branding/features/getbranding/BrandingResponse';
import { GetBrandingQuery } from '@application/modules/branding/features/getbranding/GetBrandingQuery';
import { RemoveBrandingAssetCommand } from '@application/modules/branding/features/removebrandingasset/RemoveBrandingAssetCommand';
import { UpdateBrandingCommand } from '@application/modules/branding/features/updatebranding/UpdateBrandingCommand';
import { UpdateBrandingRequest } from '@application/modules/branding/features/updatebranding/UpdateBrandingRequest';
import { UploadBrandingAssetCommand } from '@application/modules/branding/features/uploadbrandingasset/UploadBrandingAssetCommand';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { ClientMeta } from '../common/ClientMeta';
import { CurrentActor } from '../common/CurrentActor';
import { RawBody } from '../common/RawBody';

@ApiTags(SwaggerTag.Branding)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'PERMISSION_DENIED' })
@Controller(ApiRoute.MyBranding)
export class BrandingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: "The company's theme (any tenant user)" })
  @ApiResponse({ status: 200, type: BrandingResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND (nothing configured: use the defaults)' })
  get(@CurrentActor() actor: Actor): Promise<BrandingResponse> {
    return this.queryBus.execute(new GetBrandingQuery(actor));
  }

  @Put()
  @ApiOperation({ summary: 'Update colours (partial; null resets). Needs branding.edit' })
  @ApiResponse({ status: 200, type: BrandingResponse })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (per colour)' })
  update(
    @CurrentActor() actor: Actor,
    @Body() request: UpdateBrandingRequest,
    @ClientMeta() meta: RequestMeta,
  ): Promise<BrandingResponse> {
    return this.commandBus.execute(new UpdateBrandingCommand(actor, request, meta));
  }

  @Post('assets/:kind')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload the logo, favicon or background as raw bytes. Needs branding.edit',
  })
  @ApiConsumes('image/png', 'image/jpeg', 'image/webp')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  @ApiResponse({ status: 200, type: BrandingResponse })
  @ApiResponse({
    status: 413,
    description: 'PAYLOAD_TOO_LARGE (logo 512 KB, favicon 128 KB, background 2 MB)',
  })
  @ApiResponse({ status: 415, description: 'UNSUPPORTED_MEDIA_TYPE (PNG, JPEG or WebP only)' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (kind, file)' })
  upload(
    @CurrentActor() actor: Actor,
    @Param('kind') kind: string,
    @RawBody() bytes: Buffer,
    @ClientMeta() meta: RequestMeta,
  ): Promise<BrandingResponse> {
    return this.commandBus.execute(new UploadBrandingAssetCommand(actor, kind, bytes, meta));
  }

  @Delete('assets/:kind')
  @ApiOperation({ summary: 'Remove the logo, favicon or background. Needs branding.edit' })
  @ApiResponse({ status: 200, type: BrandingResponse })
  remove(
    @CurrentActor() actor: Actor,
    @Param('kind') kind: string,
    @ClientMeta() meta: RequestMeta,
  ): Promise<BrandingResponse> {
    return this.commandBus.execute(new RemoveBrandingAssetCommand(actor, kind, meta));
  }
}
