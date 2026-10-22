import { Sequelize } from 'sequelize';

import { migrate } from './migrator';

/** `npm run db:migrate` — applies pending migrations to DATABASE_URL. */
async function main(): Promise<void> {
  process.loadEnvFile?.();
  const sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
  try {
    const applied = await migrate(sequelize);
    process.stdout.write(applied.length ? `Applied: ${applied.join(', ')}\n` : 'Up to date.\n');
  } finally {
    await sequelize.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
