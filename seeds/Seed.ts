import { Sequelize } from 'sequelize';

export interface Seed {
  readonly name: string;
  run(sequelize: Sequelize): Promise<void>;
}
