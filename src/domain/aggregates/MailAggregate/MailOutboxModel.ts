import { Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript';

import { uuidv7 } from '@shared/utils/Uuid';

/** Every message the API would e-mail (no provider yet; see ConsoleMailer). */
@Table({ tableName: 'mail_outbox', underscored: true, timestamps: true, updatedAt: false })
export class MailOutboxModel extends Model {
  @PrimaryKey
  @Default(uuidv7)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.CITEXT, allowNull: false })
  toEmail!: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  subject!: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  body!: string;

  @Column({ type: DataType.DATE, allowNull: true })
  sentAt!: Date | null;

  createdAt!: Date;
}
