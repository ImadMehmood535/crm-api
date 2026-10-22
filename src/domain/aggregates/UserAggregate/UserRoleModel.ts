import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';

import { RoleModel } from '../RoleAggregate/RoleModel';
import { UserModel } from './UserModel';

/** Join table owned by the User aggregate: which roles a user holds. */
@Table({ tableName: 'user_roles', underscored: true, timestamps: false })
export class UserRoleModel extends Model {
  @PrimaryKey
  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  userId!: string;

  @PrimaryKey
  @ForeignKey(() => RoleModel)
  @Column(DataType.UUID)
  roleId!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  assignedBy!: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  assignedAt!: Date;
}
