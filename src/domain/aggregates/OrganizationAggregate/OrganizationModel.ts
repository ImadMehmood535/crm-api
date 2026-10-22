import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { UserModel } from '../UserAggregate/UserModel';

export type OrganizationStatus = 'active' | 'suspended';

@Table({ tableName: 'organizations', underscored: true, timestamps: true })
export class OrganizationModel extends BaseModel {
  @Column({ type: DataType.STRING(120), allowNull: false })
  name!: string;

  @Column({ type: DataType.CITEXT, allowNull: false })
  slug!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  status!: OrganizationStatus;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;
}
