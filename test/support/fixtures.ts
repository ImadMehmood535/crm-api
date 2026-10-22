import { Sequelize } from 'sequelize';

import { ScryptPasswordHasher } from '../../src/infrastructure/security/ScryptPasswordHasher';
import { uuidv7 } from '../../src/shared/utils/Uuid';

const hasher = new ScryptPasswordHasher();

export const PASSWORD = 'Correct-Password-123';

export async function createOrganization(
  sequelize: Sequelize,
  values: { name?: string; slug?: string; status?: 'active' | 'suspended' } = {},
): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    'INSERT INTO organizations (id, name, slug, status) VALUES (:id, :name, :slug, :status)',
    {
      replacements: {
        id,
        name: values.name ?? 'Skyline Developers',
        slug: values.slug ?? `org-${id.slice(-12)}`,
        status: values.status ?? 'active',
      },
    },
  );
  return id;
}

export async function createRole(
  sequelize: Sequelize,
  values: {
    code: string;
    organizationId?: string | null;
    isActive?: boolean;
    isSystemRole?: boolean;
  },
): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    `INSERT INTO roles (id, organization_id, code, name, is_system_role, is_active)
     VALUES (:id, :organizationId, :code, :code, :isSystemRole, :isActive)`,
    {
      replacements: {
        id,
        organizationId: values.organizationId ?? null,
        code: values.code,
        isSystemRole: values.isSystemRole ?? false,
        isActive: values.isActive ?? true,
      },
    },
  );
  return id;
}

export interface UserFixture {
  email: string;
  organizationId?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
  password?: string;
  mustReset?: boolean;
  roleIds?: string[];
  firstName?: string;
  lastName?: string;
}

export async function createUser(sequelize: Sequelize, values: UserFixture): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    `INSERT INTO users (id, organization_id, email, first_name, last_name, status)
     VALUES (:id, :organizationId, :email, :firstName, :lastName, :status)`,
    {
      replacements: {
        id,
        organizationId: values.organizationId ?? null,
        email: values.email,
        firstName: values.firstName ?? 'Test',
        lastName: values.lastName ?? 'User',
        status: values.status ?? 'active',
      },
    },
  );
  await sequelize.query(
    `INSERT INTO user_credentials (user_id, password_hash, must_reset_password)
     VALUES (:id, :hash, :mustReset)`,
    {
      replacements: {
        id,
        hash: await hasher.hash(values.password ?? PASSWORD),
        mustReset: values.mustReset ?? false,
      },
    },
  );
  for (const roleId of values.roleIds ?? []) {
    await sequelize.query('INSERT INTO user_roles (user_id, role_id) VALUES (:id, :roleId)', {
      replacements: { id, roleId },
    });
  }
  return id;
}

export async function createInvite(
  sequelize: Sequelize,
  values: {
    invitedBy: string;
    email?: string;
    slug?: string;
    status?: 'pending' | 'accepted' | 'revoked';
    expiresAt?: Date;
    tokenHash?: string;
    createdAt?: Date;
  },
): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    `INSERT INTO invites (id, email, first_name, last_name, organization_name, slug, token_hash, status,
                          expires_at, invited_by, created_at)
     VALUES (:id, :email, 'Ali', 'Raza', 'Harbor Homes', :slug, :tokenHash, :status, :expiresAt, :invitedBy, :createdAt)`,
    {
      replacements: {
        id,
        email: values.email ?? `invitee-${id.slice(-8)}@example.com`,
        slug: values.slug ?? `harbor-${id.slice(-8)}`,
        tokenHash: values.tokenHash ?? id.replace(/-/g, '').padEnd(64, '0'),
        status: values.status ?? 'pending',
        expiresAt: values.expiresAt ?? new Date(Date.now() + 7 * 86_400_000),
        invitedBy: values.invitedBy,
        createdAt: values.createdAt ?? new Date(),
      },
    },
  );
  return id;
}
