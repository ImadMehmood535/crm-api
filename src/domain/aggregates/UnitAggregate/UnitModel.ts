import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { ProjectModel } from '../ProjectAggregate/ProjectModel';
import { UserModel } from '../UserAggregate/UserModel';
import { UnitStatus, UnitType } from './Unit';

/** numeric(10,2)/(14,2) come back from pg as strings: repositories convert with Number(). */
@Table({ tableName: 'units', underscored: true, timestamps: true })
export class UnitModel extends BaseModel {
  @Column({ type: DataType.UUID, allowNull: false })
  organizationId!: string;

  @ForeignKey(() => ProjectModel)
  @Column({ type: DataType.UUID, allowNull: false })
  projectId!: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  number!: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  numberKey!: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  numberSort!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  type!: UnitType;

  @Column({ type: DataType.STRING(20), allowNull: false })
  status!: UnitStatus;

  @Column({ type: DataType.SMALLINT, allowNull: true })
  bedrooms!: number | null;

  @Column({ type: DataType.SMALLINT, allowNull: true })
  bathrooms!: number | null;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  areaSqm!: string | null;

  @Column({ type: DataType.SMALLINT, allowNull: true })
  floor!: number | null;

  @Column({ type: DataType.DECIMAL(14, 2), allowNull: true })
  price!: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;
}
