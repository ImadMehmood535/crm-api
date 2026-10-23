import { QueryTypes, Sequelize } from 'sequelize';

import { LEVEL_ROLE, ROLE_LEVELS } from '../src/shared/auth/LevelRoles';
import { uuidv7 } from '../src/shared/utils/Uuid';
import { Seed } from './Seed';

const ORGANIZATIONS_SQL = 'SELECT id FROM organizations';

const INSERT_LEVEL_ROLE_SQL = `
  INSERT INTO roles (id, organization_id, code, name, description, is_system_role, level_role)
  SELECT :id, :organizationId, :code, :name, :description, false, :level
  WHERE NOT EXISTS (SELECT 1 FROM roles WHERE organization_id = :organizationId
                    AND level_role = :level AND is_active)`;

const LEVEL_ROLE_ID_SQL = `
  SELECT id FROM roles WHERE organization_id = :organizationId AND level_role = :level AND is_active`;

// Admins and heads (never the owner) hold exactly their level role.
const HOLDERS_SQL = `
  SELECT u.id FROM users u
  WHERE u.organization_id = :organizationId AND u.level = :level
    AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = u.id AND r.is_system_role)`;

const DROP_OTHER_ROLES_SQL =
  'DELETE FROM user_roles WHERE user_id = :userId AND role_id <> :roleId';
const ASSIGN_SQL = `INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :roleId)
  ON CONFLICT (user_id, role_id) DO NOTHING`;

/** Creates the built-in level roles of every company and moves admins and heads onto them. */
export async function seedLevelRoles(sequelize: Sequelize): Promise<void> {
  const organizations = await sequelize.query<{ id: string }>(ORGANIZATIONS_SQL, {
    type: QueryTypes.SELECT,
  });
  for (const { id: organizationId } of organizations) {
    await sequelize.transaction(async (transaction) => {
      for (const level of ROLE_LEVELS) {
        await sequelize.query(INSERT_LEVEL_ROLE_SQL, {
          replacements: { id: uuidv7(), organizationId, level, ...LEVEL_ROLE[level] },
          transaction,
        });
        const [{ id: roleId }] = await sequelize.query<{ id: string }>(LEVEL_ROLE_ID_SQL, {
          replacements: { organizationId, level },
          type: QueryTypes.SELECT,
          transaction,
        });
        const holders = await sequelize.query<{ id: string }>(HOLDERS_SQL, {
          replacements: { organizationId, level },
          type: QueryTypes.SELECT,
          transaction,
        });
        for (const { id: userId } of holders) {
          await sequelize.query(DROP_OTHER_ROLES_SQL, {
            replacements: { userId, roleId },
            transaction,
          });
          await sequelize.query(ASSIGN_SQL, { replacements: { userId, roleId }, transaction });
        }
      }
    });
  }
}

export const levelRolesSeed: Seed = {
  name: 'level-roles',
  run: seedLevelRoles,
};
