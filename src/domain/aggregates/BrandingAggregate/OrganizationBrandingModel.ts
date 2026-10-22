import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';

import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';
import { UserModel } from '../UserAggregate/UserModel';

@Table({ tableName: 'organization_branding', underscored: true, timestamps: true })
export class OrganizationBrandingModel extends Model {
  @PrimaryKey
  @ForeignKey(() => OrganizationModel)
  @Column(DataType.UUID)
  organizationId!: string;

  @Column({ type: DataType.CHAR(7), allowNull: true })
  primaryColor!: string | null;

  @Column({ type: DataType.CHAR(7), allowNull: true })
  secondaryColor!: string | null;

  @Column({ type: DataType.CHAR(7), allowNull: true })
  accentColor!: string | null;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  updatedBy!: string | null;
}
