import { QueryTypes, Sequelize } from 'sequelize';

import { uuidv7 } from '../src/shared/utils/Uuid';
import { Seed } from './Seed';

interface CatalogueModule {
  code: string;
  name: string;
  actions: Array<[action: string, label: string]>;
}

/** The tenant permission catalogue, in the order and wording the frontend's matrix shows. */
export const PERMISSION_CATALOGUE: readonly CatalogueModule[] = [
  {
    code: 'users',
    name: 'Users',
    actions: [
      ['view', 'View users'],
      ['create', 'Add users'],
      ['edit', 'Edit users and their roles'],
      ['deactivate', 'Deactivate / reactivate users'],
    ],
  },
  {
    code: 'roles',
    name: 'Roles',
    actions: [
      ['view', 'View roles'],
      ['create', 'Create roles'],
      ['edit', 'Edit roles'],
      ['delete', 'Delete roles'],
    ],
  },
  {
    code: 'projects',
    name: 'Projects',
    actions: [
      ['view', 'View projects'],
      ['create', 'Create projects'],
      ['edit', 'Edit projects'],
      ['delete', 'Delete projects'],
    ],
  },
  {
    code: 'units',
    name: 'Units',
    actions: [
      ['view', 'View units'],
      ['create', 'Create units'],
      ['edit', 'Edit units'],
      ['delete', 'Delete units'],
    ],
  },
  {
    code: 'branding',
    name: 'Company branding',
    actions: [
      ['view', 'View branding'],
      ['edit', 'Edit branding'],
    ],
  },
];

/** Upserts every module and permission by code; safe to run on every deploy. */
export async function seedPermissionCatalogue(sequelize: Sequelize): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    for (const [moduleIndex, module] of PERMISSION_CATALOGUE.entries()) {
      const [{ id: moduleId }] = await sequelize.query<{ id: string }>(
        `INSERT INTO modules (id, code, name, sort_order) VALUES (:id, :code, :name, :sortOrder)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()
         RETURNING id`,
        {
          replacements: {
            id: uuidv7(),
            code: module.code,
            name: module.name,
            sortOrder: moduleIndex,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      for (const [actionIndex, [action, label]] of module.actions.entries()) {
        await sequelize.query(
          `INSERT INTO permissions (id, module_id, action, code, name, sort_order)
           VALUES (:id, :moduleId, :action, :code, :name, :sortOrder)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()`,
          {
            replacements: {
              id: uuidv7(),
              moduleId,
              action,
              code: `${module.code}.${action}`,
              name: label,
              sortOrder: actionIndex,
            },
            transaction,
          },
        );
      }
    }
  });
}

export const permissionCatalogueSeed: Seed = {
  name: 'permission-catalogue',
  run: seedPermissionCatalogue,
};
