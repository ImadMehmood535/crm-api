import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import {
  BrandingAssetFile,
  BrandingReadModel,
  IBrandingQueries,
} from './abstraction/IBrandingQueries';

export const ASSET_URL_PREFIX = '/api/v1/branding-assets/';

const BRANDING_SQL = `
  SELECT b.primary_color, b.secondary_color, b.accent_color,
         (SELECT id FROM branding_assets WHERE organization_id = :organizationId AND kind = 'logo') AS logo_id,
         (SELECT id FROM branding_assets WHERE organization_id = :organizationId AND kind = 'favicon') AS favicon_id,
         (SELECT id FROM branding_assets WHERE organization_id = :organizationId AND kind = 'background') AS background_id
  FROM (SELECT 1) one
  LEFT JOIN organization_branding b ON b.organization_id = :organizationId`;

const ASSET_SQL = 'SELECT content_type, data FROM branding_assets WHERE id = :id';

interface Row {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  logo_id: string | null;
  favicon_id: string | null;
  background_id: string | null;
}

const url = (id: string | null): string | null => (id ? `${ASSET_URL_PREFIX}${id}` : null);

@Injectable()
export class BrandingQueries implements IBrandingQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findBranding(organizationId: string): Promise<BrandingReadModel | null> {
    const [row] = await this.sequelize.query<Row>(BRANDING_SQL, {
      replacements: { organizationId },
      type: QueryTypes.SELECT,
    });
    const branding: BrandingReadModel = {
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      logoUrl: url(row.logo_id),
      faviconUrl: url(row.favicon_id),
      backgroundImageUrl: url(row.background_id),
    };
    return Object.values(branding).some((value) => value !== null) ? branding : null;
  }

  async findAsset(id: string): Promise<BrandingAssetFile | null> {
    const rows = await this.sequelize.query<{ content_type: string; data: Buffer }>(ASSET_SQL, {
      replacements: { id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? { contentType: rows[0].content_type, data: rows[0].data } : null;
  }
}
