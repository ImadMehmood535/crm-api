import { BelongsTo, Column, DataType, ForeignKey, HasOne, Table } from 'sequelize-typescript';

import { BaseModel } from '../BaseModel';
import { OrganizationModel } from '../OrganizationAggregate/OrganizationModel';
import { UserCredentialModel } from './UserCredentialModel';

import { UserStatus } from './UserStatus';

@Table({ tableName: 'users', underscored: true, timestamps: true })
export class UserModel extends BaseModel {
  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: true })
  organizationId!: string | null;

  @BelongsTo(() => OrganizationModel)
  organization!: OrganizationModel | null;

  @Column({ type: DataType.CITEXT, allowNull: false })
  email!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  firstName!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  lastName!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  status!: UserStatus;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  isSystem!: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  lastLoginAt!: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  deactivatedAt!: Date | null;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;

  @HasOne(() => UserCredentialModel)
  credential!: UserCredentialModel | null;
}
