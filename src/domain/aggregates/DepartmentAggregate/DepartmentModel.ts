import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';
import { UserModel } from '../UserAggregate/UserModel';

@Table({ tableName: 'departments', underscored: true, timestamps: true })
export class DepartmentModel extends BaseModel {
  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: false })
  organizationId!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  nameKey!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  headUserId!: string | null;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  isActive!: boolean;
}
