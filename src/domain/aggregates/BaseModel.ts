import { Column, DataType, Default, Model, PrimaryKey } from 'sequelize-typescript';

import { uuidv7 } from '@shared/utils/Uuid';

/**
 * Columns every table shares: a UUID v7 `id` and `created_at` / `updated_at`.
 * Tables use `@Table({ tableName, underscored: true, timestamps: true })`, so Sequelize
 * stamps the two timestamps itself — never set them by hand.
 */
export abstract class BaseModel extends Model {
  @PrimaryKey
  @Default(uuidv7)
  @Column(DataType.UUID)
  id!: string;

  createdAt!: Date;
  updatedAt!: Date;
}
