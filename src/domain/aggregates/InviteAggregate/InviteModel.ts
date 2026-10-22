import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { UserModel } from '../UserAggregate/UserModel';
import { StoredInviteStatus } from './Invite';

@Table({ tableName: 'invites', underscored: true, timestamps: true })
export class InviteModel extends BaseModel {
  @Column({ type: DataType.CITEXT, allowNull: false })
  email!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  firstName!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  lastName!: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  organizationName!: string;

  @Column({ type: DataType.CITEXT, allowNull: false })
  slug!: string;

  @Column({ type: DataType.CHAR(64), allowNull: false })
  tokenHash!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  status!: StoredInviteStatus;

  @Column({ type: DataType.DATE, allowNull: false })
  expiresAt!: Date;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  invitedBy!: string;

  @Column({ type: DataType.DATE, allowNull: true })
  acceptedAt!: Date | null;
}
