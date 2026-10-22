import { Sequelize } from 'sequelize';

import { seedPermissionCatalogue } from '../../seeds/permission-catalogue.seed';
import { migrate } from '../../src/infrastructure/persistence/migrator';

/** Migrates and seeds reference data once per run. Refuses anything not named *_test (tests truncate). */
export default async function globalSetup(): Promise<void> {
  process.loadEnvFile?.();
  const url = process.env.DATABASE_URL_TEST ?? '';
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('DATABASE_URL_TEST must point to a database whose name ends in _test.');
  }
  const sequelize = new Sequelize(url, { logging: false });
  try {
    await migrate(sequelize);
    await seedPermissionCatalogue(sequelize);
  } finally {
    await sequelize.close();
  }
}
