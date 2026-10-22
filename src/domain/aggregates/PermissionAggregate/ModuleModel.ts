import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';

/** A functional area of the CRM in the permission catalogue (seeded reference data). */
@Table({ tableName: 'modules', underscored: true, timestamps: true })
export class ModuleModel extends BaseModel {
  @Column({ type: DataType.STRING(100), allowNull: false })
  code!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @ForeignKey(() => ModuleModel)
  @Column({ type: DataType.UUID, allowNull: true })
  parentModuleId!: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  description!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false })
  sortOrder!: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  isActive!: boolean;
}
