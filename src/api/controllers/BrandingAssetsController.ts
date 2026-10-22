import { Controller, Get, Param, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { BrandingAssetFile } from '@application/modules/branding/features/getbrandingasset/BrandingAssetFile';
import { GetBrandingAssetQuery } from '@application/modules/branding/features/getbrandingasset/GetBrandingAssetQuery';

import { ApiRoute, SwaggerTag } from '../common/ApiConstants';
import { Public } from '../common/Public';
import { RawResponse } from '../common/RawResponse';
import { ParseUuidPipe } from '../pipes/ParseUuidPipe';

const IMMUTABLE = 'public, max-age=31536000, immutable';

@ApiTags(SwaggerTag.Branding)
@Public()
@Controller(ApiRoute.BrandingAssets)
export class BrandingAssetsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @RawResponse()
  @ApiOperation({ summary: 'A branding image (public, immutable, not enveloped)' })
  @ApiResponse({ status: 200, description: 'The image bytes' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  async get(@Param('id', ParseUuidPipe) id: string, @Res() response: Response): Promise<void> {
    const file = await this.queryBus.execute<GetBrandingAssetQuery, BrandingAssetFile>(
      new GetBrandingAssetQuery(id),
    );
    response
      .status(200)
      .set({
        'Content-Type': file.contentType,
        'Content-Length': String(file.data.length),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        'Cache-Control': IMMUTABLE,
      })
      .end(file.data);
  }
}
