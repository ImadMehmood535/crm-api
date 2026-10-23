import { QueryTypes, Sequelize } from 'sequelize';

import { truncateAll } from '../test/support/db';
import { createHierarchy, createRole } from '../test/support/fixtures';
import { seedLevelRoles } from './level-roles.seed';

describe('level-roles seed (integration)', () => {
  let sequelize: Sequelize;
  let h: Record<string, string>;

  beforeAll(() => {
    sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    h = await createHierarchy(sequelize);
    const staff = await createRole(sequelize, { code: 'staff', organizationId: h.org });
    for (const who of ['admin1', 'head1', 'member1']) {
      await sequelize.query('INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :roleId)', {
        replacements: { userId: h[who], roleId: staff },
      });
    }
  });
  afterAll(() => sequelize.close());

  const rolesOf = async (userId: string): Promise<string[]> =>
    (
      await sequelize.query<{ code: string }>(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = :userId ORDER BY r.code`,
        { replacements: { userId }, type: QueryTypes.SELECT },
      )
    ).map((r) => r.code);

  it('should create the level roles once and move admins and heads onto them, twice safely', async () => {
    await seedLevelRoles(sequelize);
    await seedLevelRoles(sequelize);

    const [{ count }] = await sequelize.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM roles WHERE organization_id = :org AND level_role IS NOT NULL',
      { replacements: { org: h.org }, type: QueryTypes.SELECT },
    );
    expect(count).toBe(2);
    expect(await rolesOf(h.admin1)).toEqual(['level_admin']);
    expect(await rolesOf(h.head1)).toEqual(['level_department_head']);
    expect(await rolesOf(h.member1)).toEqual(['staff']);
    expect(await rolesOf(h.owner)).toEqual(['developer_super_user']);
  });
});
