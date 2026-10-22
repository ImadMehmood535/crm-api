import { Branding } from '@domain/aggregates/BrandingAggregate/Branding';
import { AssetKind, ImageType } from '@domain/aggregates/BrandingAggregate/BrandingImage';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const BRANDING_REPOSITORY = Symbol('BRANDING_REPOSITORY');

export interface IBrandingRepository {
  findColors(organizationId: string): Promise<Branding>;
  saveColors(branding: Branding, updatedBy: string, tx?: Tx): Promise<void>;
  /** Deletes any image of this kind and stores the new one; returns its (new) id. */
  replaceAsset(
    organizationId: string,
    kind: AssetKind,
    contentType: ImageType,
    data: Buffer,
    tx?: Tx,
  ): Promise<string>;
  removeAsset(organizationId: string, kind: AssetKind, tx?: Tx): Promise<void>;
}
