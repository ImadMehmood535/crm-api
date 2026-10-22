import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { BrandingPersistenceModule } from '@infrastructure/persistence/BrandingPersistenceModule';

import { GetBrandingQueryHandler } from './features/getbranding/GetBrandingQueryHandler';
import { GetBrandingAssetQueryHandler } from './features/getbrandingasset/GetBrandingAssetQueryHandler';
import { RemoveBrandingAssetCommandHandler } from './features/removebrandingasset/RemoveBrandingAssetCommandHandler';
import { UpdateBrandingCommandHandler } from './features/updatebranding/UpdateBrandingCommandHandler';
import { UploadBrandingAssetCommandHandler } from './features/uploadbrandingasset/UploadBrandingAssetCommandHandler';

@Module({
  imports: [CqrsModule, BrandingPersistenceModule],
  providers: [
    GetBrandingQueryHandler,
    UpdateBrandingCommandHandler,
    UploadBrandingAssetCommandHandler,
    RemoveBrandingAssetCommandHandler,
    GetBrandingAssetQueryHandler,
  ],
})
export class BrandingModule {}
