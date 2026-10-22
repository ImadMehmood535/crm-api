import { QueryTypes, Sequelize } from 'sequelize';

/** Empties every application table (never schema_migrations). Test databases only. */
export async function truncateAll(sequelize: Sequelize): Promise<void> {
  const tables = await sequelize.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
    { type: QueryTypes.SELECT },
  );
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await sequelize.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
