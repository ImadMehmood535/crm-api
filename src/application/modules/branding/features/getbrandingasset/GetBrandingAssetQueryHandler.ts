import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotFoundError } from '@shared/errors/AppError';
import {
  BRANDING_QUERIES,
  IBrandingQueries,
} from '@infrastructure/queries/abstraction/IBrandingQueries';

import { BrandingAssetFile } from './BrandingAssetFile';
import { GetBrandingAssetQuery } from './GetBrandingAssetQuery';

/** Public: the images are what an unauthenticated favicon/logo request needs. */
@QueryHandler(GetBrandingAssetQuery)
export class GetBrandingAssetQueryHandler implements IQueryHandler<
  GetBrandingAssetQuery,
  BrandingAssetFile
> {
  constructor(@Inject(BRANDING_QUERIES) private readonly queries: IBrandingQueries) {}

  async execute(query: GetBrandingAssetQuery): Promise<BrandingAssetFile> {
    const file = await this.queries.findAsset(query.id);
    if (!file) throw new NotFoundError('Image not found.');
    return file;
  }
}
