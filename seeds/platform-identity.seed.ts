import { QueryTypes, Sequelize } from 'sequelize';

import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher';
import { uuidv7 } from '../src/shared/utils/Uuid';
import { Seed } from './Seed';

const PASSWORD_MIN_LENGTH = 12;

export const PLATFORM_ROLES = [
  { code: 'platform_super_user', name: 'Platform Super User' },
  { code: 'platform_admin', name: 'Platform Admin' },
] as const;

export interface PlatformSuperUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Reads PLATFORM_SUPER_USER_* from the environment; null when no email is configured. */
export function superUserFromEnv(env: NodeJS.ProcessEnv = process.env): PlatformSuperUser | null {
  const email = env.PLATFORM_SUPER_USER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const password = env.PLATFORM_SUPER_USER_PASSWORD ?? '';
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `PLATFORM_SUPER_USER_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }
  return {
    email,
    password,
    firstName: env.PLATFORM_SUPER_USER_FIRST_NAME || 'Platform',
    lastName: env.PLATFORM_SUPER_USER_LAST_NAME || 'Owner',
  };
}

/** Platform roles always; the platform super user once (an existing user is never touched). */
export async function seedPlatformIdentity(
  sequelize: Sequelize,
  superUser: PlatformSuperUser | null,
): Promise<void> {
  for (const role of PLATFORM_ROLES) {
    await sequelize.query(
      `INSERT INTO roles (id, organization_id, code, name, is_system_role)
       VALUES (:id, NULL, :code, :name, true)
       ON CONFLICT (code) WHERE organization_id IS NULL DO NOTHING`,
      { replacements: { id: uuidv7(), ...role } },
    );
  }
  if (!superUser) return;

  const existing = await sequelize.query('SELECT 1 FROM users WHERE email = :email', {
    replacements: { email: superUser.email },
    type: QueryTypes.SELECT,
  });
  if (existing.length > 0) return;

  const passwordHash = await new ScryptPasswordHasher().hash(superUser.password);
  await sequelize.transaction(async (transaction) => {
    const id = uuidv7();
    await sequelize.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, status, is_system)
       VALUES (:id, NULL, :email, :firstName, :lastName, 'active', true)`,
      { replacements: { id, ...superUser }, transaction },
    );
    await sequelize.query(
      'INSERT INTO user_credentials (user_id, password_hash, must_reset_password) VALUES (:id, :passwordHash, false)',
      { replacements: { id, passwordHash }, transaction },
    );
    await sequelize.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT :id, r.id FROM roles r WHERE r.code = 'platform_super_user' AND r.organization_id IS NULL`,
      { replacements: { id }, transaction },
    );
  });
}

export const platformIdentitySeed: Seed = {
  name: 'platform-identity',
  run: (sequelize) => seedPlatformIdentity(sequelize, superUserFromEnv()),
};
