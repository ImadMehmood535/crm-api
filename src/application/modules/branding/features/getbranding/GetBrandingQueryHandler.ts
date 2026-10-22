import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  BRANDING_QUERIES,
  IBrandingQueries,
} from '@infrastructure/queries/abstraction/IBrandingQueries';
import { requireTenant } from '@application/common/Authorization';

import { brandingNotConfigured } from '../../BrandingReads';
import { BrandingResponse } from './BrandingResponse';
import { GetBrandingQuery } from './GetBrandingQuery';

/** Any tenant user may read the theme; 404 while nothing is configured (the UI uses defaults). */
@QueryHandler(GetBrandingQuery)
export class GetBrandingQueryHandler implements IQueryHandler<GetBrandingQuery, BrandingResponse> {
  constructor(@Inject(BRANDING_QUERIES) private readonly branding: IBrandingQueries) {}

  async execute(query: GetBrandingQuery): Promise<BrandingResponse> {
    const organizationId = requireTenant(query.actor);
    const branding = await this.branding.findBranding(organizationId);
    if (!branding) throw brandingNotConfigured();
    return BrandingResponse.from(branding);
  }
}
