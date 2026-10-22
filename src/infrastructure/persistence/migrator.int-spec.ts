import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { QueryTypes, Sequelize } from 'sequelize';

import { migrate } from './migrator';

describe('migrate', () => {
  let sequelize: Sequelize;
  let dir: string;

  beforeAll(() => {
    sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  });

  afterEach(async () => {
    await sequelize.query('DROP TABLE IF EXISTS zz_migrator_a, zz_migrator_b');
    await sequelize.query("DELETE FROM schema_migrations WHERE name LIKE 'zz_%'");
  });

  afterAll(() => sequelize.close());

  const tableExists = async (name: string): Promise<boolean> => {
    const rows = await sequelize.query('SELECT to_regclass(:name) AS t', {
      replacements: { name },
      type: QueryTypes.SELECT,
    });
    return (rows[0] as { t: string | null }).t !== null;
  };

  it('should apply pending files in order and record them', async () => {
    writeFileSync(join(dir, 'zz_2.sql'), 'CREATE TABLE zz_migrator_b (id int);');
    writeFileSync(join(dir, 'zz_1.sql'), 'CREATE TABLE zz_migrator_a (id int);');

    const applied = await migrate(sequelize, dir);

    expect(applied).toEqual(['zz_1.sql', 'zz_2.sql']);
    expect(await tableExists('zz_migrator_a')).toBe(true);
  });

  it('should apply nothing when rerun', async () => {
    writeFileSync(join(dir, 'zz_1.sql'), 'CREATE TABLE zz_migrator_a (id int);');
    await migrate(sequelize, dir);

    const applied = await migrate(sequelize, dir);

    expect(applied).toEqual([]);
  });

  it('should roll back and not record a failing file', async () => {
    writeFileSync(join(dir, 'zz_1.sql'), 'CREATE TABLE zz_migrator_a (id int); SELECT broken;');

    await expect(migrate(sequelize, dir)).rejects.toThrow();

    expect(await tableExists('zz_migrator_a')).toBe(false);
    const recorded = await sequelize.query(
      "SELECT 1 FROM schema_migrations WHERE name = 'zz_1.sql'",
      {
        type: QueryTypes.SELECT,
      },
    );
    expect(recorded).toHaveLength(0);
  });
});
