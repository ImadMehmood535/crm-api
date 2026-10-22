import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { Branding } from '@domain/aggregates/BrandingAggregate/Branding';
import { BrandingAssetModel } from '@domain/aggregates/BrandingAggregate/BrandingAssetModel';
import { AssetKind, ImageType } from '@domain/aggregates/BrandingAggregate/BrandingImage';
import { OrganizationBrandingModel } from '@domain/aggregates/BrandingAggregate/OrganizationBrandingModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IBrandingRepository } from './abstraction/IBrandingRepository';

@Injectable()
export class BrandingRepository implements IBrandingRepository {
  constructor(
    @InjectModel(OrganizationBrandingModel)
    private readonly brandingModel: typeof OrganizationBrandingModel,
    @InjectModel(BrandingAssetModel) private readonly assetModel: typeof BrandingAssetModel,
  ) {}

  async findColors(organizationId: string): Promise<Branding> {
    const row = await this.brandingModel.findByPk(organizationId);
    if (!row) return Branding.empty(organizationId);
    return Branding.rehydrate(organizationId, {
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      accentColor: row.accentColor,
    });
  }

  async saveColors(branding: Branding, updatedBy: string, tx?: Tx): Promise<void> {
    await this.brandingModel.upsert(
      { organizationId: branding.organizationId, ...branding.colors, updatedBy },
      { transaction: tx as Transaction },
    );
  }

  async replaceAsset(
    organizationId: string,
    kind: AssetKind,
    contentType: ImageType,
    data: Buffer,
    tx?: Tx,
  ): Promise<string> {
    const transaction = tx as Transaction;
    await this.assetModel.destroy({ where: { organizationId, kind }, transaction });
    const row = await this.assetModel.create(
      { organizationId, kind, contentType, sizeBytes: data.length, data },
      { transaction },
    );
    return row.id;
  }

  async removeAsset(organizationId: string, kind: AssetKind, tx?: Tx): Promise<void> {
    await this.assetModel.destroy({
      where: { organizationId, kind },
      transaction: tx as Transaction,
    });
  }
}
