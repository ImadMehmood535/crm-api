import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

import { uuidv7 } from '@shared/utils/Uuid';

import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';
import { AssetKind, ImageType } from './BrandingImage';

/** One image per kind per company. Replacing creates a new row (a new, immutable URL). */
@Table({ tableName: 'branding_assets', underscored: true, timestamps: true, updatedAt: false })
export class BrandingAssetModel extends Model {
  @PrimaryKey
  @Default(uuidv7)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: false })
  organizationId!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  kind!: AssetKind;

  @Column({ type: DataType.STRING(50), allowNull: false })
  contentType!: ImageType;

  @Column({ type: DataType.INTEGER, allowNull: false })
  sizeBytes!: number;

  @Column({ type: DataType.BLOB, allowNull: false })
  data!: Buffer;

  createdAt!: Date;
}
