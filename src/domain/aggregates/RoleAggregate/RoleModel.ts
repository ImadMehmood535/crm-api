import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';

/** organization_id NULL = platform role; otherwise a role owned by one company. */
@Table({ tableName: 'roles', underscored: true, timestamps: true })
export class RoleModel extends BaseModel {
  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: true })
  organizationId!: string | null;

  @Column({ type: DataType.STRING(50), allowNull: false })
  code!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  isSystemRole!: boolean;

  /** Set on the built-in level roles ('admin' | 'department_head'); null for other roles. */
  @Column({ type: DataType.STRING(20), allowNull: true })
  levelRole!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  isActive!: boolean;
}
