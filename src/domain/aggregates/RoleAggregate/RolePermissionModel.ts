import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';

import { PermissionModel } from '../PermissionAggregate/PermissionModel';
import { UserModel } from '../UserAggregate/UserModel';
import { RoleModel } from './RoleModel';

/** Join table owned by the Role aggregate: which permissions a role grants. */
@Table({ tableName: 'role_permissions', underscored: true, timestamps: false })
export class RolePermissionModel extends Model {
  @PrimaryKey
  @ForeignKey(() => RoleModel)
  @Column(DataType.UUID)
  roleId!: string;

  @PrimaryKey
  @ForeignKey(() => PermissionModel)
  @Column(DataType.UUID)
  permissionId!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  grantedBy!: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  grantedAt!: Date;
}
