import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { ModuleModel } from './ModuleModel';

/** One `module.action` code in the catalogue (seeded reference data). */
@Table({ tableName: 'permissions', underscored: true, timestamps: true })
export class PermissionModel extends BaseModel {
  @ForeignKey(() => ModuleModel)
  @Column({ type: DataType.UUID, allowNull: false })
  moduleId!: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  action!: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  code!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false })
  sortOrder!: number;
}
