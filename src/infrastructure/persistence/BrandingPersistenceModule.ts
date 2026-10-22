import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { BrandingAssetModel } from '@domain/aggregates/BrandingAggregate/BrandingAssetModel';
import { OrganizationBrandingModel } from '@domain/aggregates/BrandingAggregate/OrganizationBrandingModel';

import { BRANDING_QUERIES } from '../queries/abstraction/IBrandingQueries';
import { BrandingQueries } from '../queries/BrandingQueries';
import { BRANDING_REPOSITORY } from '../repositories/abstraction/IBrandingRepository';
import { BrandingRepository } from '../repositories/BrandingRepository';

@Module({
  imports: [SequelizeModule.forFeature([OrganizationBrandingModel, BrandingAssetModel])],
  providers: [
    { provide: BRANDING_REPOSITORY, useClass: BrandingRepository },
    { provide: BRANDING_QUERIES, useClass: BrandingQueries },
  ],
  exports: [BRANDING_REPOSITORY, BRANDING_QUERIES],
})
export class BrandingPersistenceModule {}
