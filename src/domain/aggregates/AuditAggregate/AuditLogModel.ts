import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

import { uuidv7 } from '@shared/utils/Uuid';

import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';
import { UserModel } from '../UserAggregate/UserModel';

/** Append-only (a database trigger refuses UPDATE and DELETE). */
@Table({ tableName: 'audit_logs', underscored: true, timestamps: true, updatedAt: false })
export class AuditLogModel extends Model {
  @PrimaryKey
  @Default(uuidv7)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  actorUserId!: string | null;

  @Column({ type: DataType.STRING(100), allowNull: false })
  action!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  entityType!: string;

  @Column({ type: DataType.UUID, allowNull: true })
  entityId!: string | null;

  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: true })
  organizationId!: string | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  oldValues!: Record<string, unknown> | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  newValues!: Record<string, unknown> | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  ip!: string | null;

  createdAt!: Date;
}
