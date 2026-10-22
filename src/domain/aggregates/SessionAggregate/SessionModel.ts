import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { UserModel } from '../UserAggregate/UserModel';

/** One row per refresh token (only its SHA-256). A login chain shares `familyId`. */
@Table({ tableName: 'user_sessions', underscored: true, timestamps: true })
export class SessionModel extends BaseModel {
  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  userId!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  familyId!: string;

  @Column({ type: DataType.CHAR(64), allowNull: false })
  refreshTokenHash!: string;

  @Column({ type: DataType.DATE, allowNull: false })
  expiresAt!: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  lastUsedAt!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  revokedAt!: Date | null;

  @Column({ type: DataType.STRING(30), allowNull: true })
  revokedReason!: string | null;

  @ForeignKey(() => SessionModel)
  @Column({ type: DataType.UUID, allowNull: true })
  replacedBy!: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  ipAddress!: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  userAgent!: string | null;
}
