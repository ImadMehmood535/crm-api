import { Sequelize } from 'sequelize';

import { SEEDS } from './index';

/** `npm run db:seed` — runs every seed in order. Seeds are idempotent, so reruns are safe. */
async function main(): Promise<void> {
  process.loadEnvFile?.();
  const sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
  try {
    for (const seed of SEEDS) {
      await seed.run(sequelize);
      process.stdout.write(`Seeded: ${seed.name}\n`);
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
