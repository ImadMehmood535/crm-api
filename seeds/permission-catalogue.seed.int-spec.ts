import { QueryTypes, Sequelize } from 'sequelize';

import { seedPermissionCatalogue } from './permission-catalogue.seed';

describe('permission catalogue seed', () => {
  let sequelize: Sequelize;

  beforeAll(() => {
    sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
  });
  afterAll(() => sequelize.close());

  it('should hold the 26 catalogue codes once each, even when run again', async () => {
    await seedPermissionCatalogue(sequelize);
    await seedPermissionCatalogue(sequelize);

    const rows = await sequelize.query<{ code: string }>(
      'SELECT p.code FROM permissions p JOIN modules m ON m.id = p.module_id ORDER BY m.sort_order, p.sort_order',
      { type: QueryTypes.SELECT },
    );
    expect(rows.map((r) => r.code)).toEqual([
      'users.view',
      'users.create',
      'users.edit',
      'users.deactivate',
      'roles.view',
      'roles.create',
      'roles.edit',
      'roles.delete',
      'departments.view',
      'departments.create',
      'departments.edit',
      'departments.delete',
      'teams.view',
      'teams.create',
      'teams.edit',
      'teams.delete',
      'projects.view',
      'projects.create',
      'projects.edit',
      'projects.delete',
      'units.view',
      'units.create',
      'units.edit',
      'units.delete',
      'branding.view',
      'branding.edit',
    ]);
  });
});
