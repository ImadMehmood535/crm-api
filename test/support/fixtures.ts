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
  level?: 'owner' | 'admin' | 'department_head' | 'member';
  createdBy?: string;
}

export async function createUser(sequelize: Sequelize, values: UserFixture): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    `INSERT INTO users (id, organization_id, email, first_name, last_name, status, level, created_by)
     VALUES (:id, :organizationId, :email, :firstName, :lastName, :status, :level, :createdBy)`,
    {
      replacements: {
        id,
        organizationId: values.organizationId ?? null,
        email: values.email,
        firstName: values.firstName ?? 'Test',
        lastName: values.lastName ?? 'User',
        status: values.status ?? 'active',
        level: values.level ?? (values.organizationId ? 'member' : null),
        createdBy: values.createdBy ?? null,
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

/** Grants catalogue codes to a role (the catalogue is seeded by the global setup). */
export async function grant(sequelize: Sequelize, roleId: string, codes: string[]): Promise<void> {
  for (const code of codes) {
    await sequelize.query(
      'INSERT INTO role_permissions (role_id, permission_id) SELECT :roleId, id FROM permissions WHERE code = :code',
      { replacements: { roleId, code } },
    );
  }
}

export async function createDepartment(
  sequelize: Sequelize,
  values: { organizationId: string; name: string; headUserId?: string | null; isActive?: boolean },
): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    `INSERT INTO departments (id, organization_id, name, name_key, head_user_id, is_active)
     VALUES (:id, :organizationId, :name, lower(:name), :headUserId, :isActive)`,
    { replacements: { id, headUserId: null, isActive: true, ...values } },
  );
  return id;
}

export async function createTeam(
  sequelize: Sequelize,
  values: {
    organizationId: string;
    departmentId: string;
    name: string;
    memberIds?: string[];
    isActive?: boolean;
  },
): Promise<string> {
  const id = uuidv7();
  await sequelize.query(
    `INSERT INTO teams (id, organization_id, department_id, name, name_key, is_active)
     VALUES (:id, :organizationId, :departmentId, :name, lower(:name), :isActive)`,
    {
      replacements: {
        id,
        organizationId: values.organizationId,
        departmentId: values.departmentId,
        name: values.name,
        isActive: values.isActive ?? true,
      },
    },
  );
  for (const userId of values.memberIds ?? []) {
    await sequelize.query('INSERT INTO team_members (team_id, user_id) VALUES (:id, :userId)', {
      replacements: { id, userId },
    });
  }
  return id;
}

/**
 * A full company hierarchy:
 *   owner ─┬─ admin1 ── head1 (Finance) ─┬─ member1 ┐ team Payables (member1, member2)
 *          │                              └─ member2 ┘
 *          ├─ admin2
 *          └─ head2 (HR, created by the owner directly) ── member3 (team Hiring)
 */
export async function createHierarchy(sequelize: Sequelize): Promise<Record<string, string>> {
  const org = await createOrganization(sequelize);
  const ownerRole = await createRole(sequelize, {
    code: 'developer_super_user',
    organizationId: org,
    isSystemRole: true,
  });
  const owner = await createUser(sequelize, {
    email: 'owner@h.example.com',
    organizationId: org,
    roleIds: [ownerRole],
    level: 'owner',
  });
  const admin1 = await createUser(sequelize, {
    email: 'admin1@h.example.com',
    organizationId: org,
    level: 'admin',
    createdBy: owner,
  });
  const admin2 = await createUser(sequelize, {
    email: 'admin2@h.example.com',
    organizationId: org,
    level: 'admin',
    createdBy: owner,
  });
  const head1 = await createUser(sequelize, {
    email: 'head1@h.example.com',
    organizationId: org,
    level: 'department_head',
    createdBy: admin1,
  });
  const member1 = await createUser(sequelize, {
    email: 'member1@h.example.com',
    organizationId: org,
    createdBy: head1,
  });
  const member2 = await createUser(sequelize, {
    email: 'member2@h.example.com',
    organizationId: org,
    createdBy: head1,
  });
  const head2 = await createUser(sequelize, {
    email: 'head2@h.example.com',
    organizationId: org,
    level: 'department_head',
    createdBy: owner,
  });
  const member3 = await createUser(sequelize, {
    email: 'member3@h.example.com',
    organizationId: org,
    createdBy: head2,
  });
  const finance = await createDepartment(sequelize, {
    organizationId: org,
    name: 'Finance',
    headUserId: head1,
  });
  const hr = await createDepartment(sequelize, {
    organizationId: org,
    name: 'HR',
    headUserId: head2,
  });
  const payables = await createTeam(sequelize, {
    organizationId: org,
    departmentId: finance,
    name: 'Payables',
    memberIds: [member1, member2],
  });
  const hiring = await createTeam(sequelize, {
    organizationId: org,
    departmentId: hr,
    name: 'Hiring',
    memberIds: [member3],
  });
  return {
    org,
    ownerRole,
    owner,
    admin1,
    admin2,
    head1,
    member1,
    member2,
    head2,
    member3,
    finance,
    hr,
    payables,
    hiring,
  };
}
