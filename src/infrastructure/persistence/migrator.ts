import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { QueryTypes, Sequelize } from 'sequelize';

export const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations');

/**
 * Applies `migrations/*.sql` in file-name order. Each file runs in its own transaction and is
 * recorded in `schema_migrations`, so a rerun only applies new files. Stops at the first failure.
 */
export async function migrate(
  sequelize: Sequelize,
  dir: string = MIGRATIONS_DIR,
): Promise<string[]> {
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const rows = await sequelize.query<{ name: string }>('SELECT name FROM schema_migrations', {
    type: QueryTypes.SELECT,
  });
  const applied = new Set(rows.map((row) => row.name));
  const pending = readdirSync(dir)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();

  for (const file of pending) {
    const sql = readFileSync(join(dir, file), 'utf8');
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(sql, { transaction });
      await sequelize.query('INSERT INTO schema_migrations (name) VALUES (:file)', {
        replacements: { file },
        transaction,
      });
    });
  }
  return pending;
}
