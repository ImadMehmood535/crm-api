import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';

import { UserModel } from './UserModel';

/** The only place a password hash lives. Never included in read models. */
@Table({ tableName: 'user_credentials', underscored: true, timestamps: true })
export class UserCredentialModel extends Model {
  @PrimaryKey
  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  userId!: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  passwordHash!: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  mustResetPassword!: boolean;

  @Column({ type: DataType.DATE, allowNull: false })
  passwordUpdatedAt!: Date;
}
