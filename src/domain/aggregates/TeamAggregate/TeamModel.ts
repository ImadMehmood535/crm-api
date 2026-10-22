import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { DepartmentModel } from '../DepartmentAggregate/DepartmentModel';
import { UserModel } from '../UserAggregate/UserModel';

@Table({ tableName: 'teams', underscored: true, timestamps: true })
export class TeamModel extends BaseModel {
  @Column({ type: DataType.UUID, allowNull: false })
  organizationId!: string;

  @ForeignKey(() => DepartmentModel)
  @Column({ type: DataType.UUID, allowNull: false })
  departmentId!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  nameKey!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  isActive!: boolean;
}
