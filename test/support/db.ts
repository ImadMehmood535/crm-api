import { QueryTypes, Sequelize } from 'sequelize';

/** Reference data seeded once by the global setup; tests never truncate it. */
const REFERENCE_TABLES = ['schema_migrations', 'modules', 'permissions'];

/** Empties every application table (never reference data). Test databases only. */
export async function truncateAll(sequelize: Sequelize): Promise<void> {
  const tables = await sequelize.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN (:reference)",
    { replacements: { reference: REFERENCE_TABLES }, type: QueryTypes.SELECT },
  );
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await sequelize.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
