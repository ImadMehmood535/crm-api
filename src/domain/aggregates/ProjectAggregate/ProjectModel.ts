import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';
import { UserModel } from '../UserAggregate/UserModel';
import { ProjectStatus } from './Project';

@Table({ tableName: 'projects', underscored: true, timestamps: true })
export class ProjectModel extends BaseModel {
  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: false })
  organizationId!: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  nameKey!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description!: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true })
  city!: string | null;

  @Column({ type: DataType.STRING(300), allowNull: true })
  address!: string | null;

  @Column({ type: DataType.CHAR(3), allowNull: false })
  currency!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  status!: ProjectStatus;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  expectedCompletion!: string | null;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;
}
