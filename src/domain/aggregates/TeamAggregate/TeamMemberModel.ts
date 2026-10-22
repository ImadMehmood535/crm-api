import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';

import { UserModel } from '../UserAggregate/UserModel';
import { TeamModel } from './TeamModel';

/** Join table owned by the Team aggregate. A user may be in many teams. */
@Table({ tableName: 'team_members', underscored: true, timestamps: false })
export class TeamMemberModel extends Model {
  @PrimaryKey
  @ForeignKey(() => TeamModel)
  @Column(DataType.UUID)
  teamId!: string;

  @PrimaryKey
  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  userId!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  addedBy!: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  addedAt!: Date;
}
