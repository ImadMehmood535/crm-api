import { Sequelize } from 'sequelize';

export interface Seed {
  readonly name: string;
  run(sequelize: Sequelize): Promise<void>;
}

/** Ordered list of seeds. Each must be idempotent (ON CONFLICT DO NOTHING / upsert). */
export const SEEDS: readonly Seed[] = [];
