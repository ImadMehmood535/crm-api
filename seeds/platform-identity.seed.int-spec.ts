import { QueryTypes, Sequelize } from 'sequelize';

import { truncateAll } from '../test/support/db';
import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher';
import { seedPlatformIdentity, superUserFromEnv } from './platform-identity.seed';

describe('platform identity seed', () => {
  let sequelize: Sequelize;
  const superUser = {
    email: 'platform@example.com',
    password: 'DemoPassword-Platform-1!',
    firstName: 'Platform',
    lastName: 'Owner',
  };

  beforeAll(() => {
    sequelize = new Sequelize(process.env.DATABASE_URL ?? '', { logging: false });
  });
  beforeEach(() => truncateAll(sequelize));
  afterAll(() => sequelize.close());

  const select = <T extends object>(sql: string): Promise<T[]> =>
    sequelize.query<T>(sql, { type: QueryTypes.SELECT });

  it('should create the platform roles and the super user with the super user role', async () => {
    await seedPlatformIdentity(sequelize, superUser);

    const roles = await select<{ code: string }>(
      'SELECT code FROM roles WHERE organization_id IS NULL ORDER BY code',
    );
    expect(roles.map((r) => r.code)).toEqual(['platform_admin', 'platform_super_user']);
    const links = await select<{ code: string }>(
      `SELECT r.code FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
       WHERE u.email = 'platform@example.com' AND u.is_system`,
    );
    expect(links).toEqual([{ code: 'platform_super_user' }]);
  });

  it('should be idempotent and never overwrite an existing password', async () => {
    await seedPlatformIdentity(sequelize, superUser);
    await seedPlatformIdentity(sequelize, { ...superUser, password: 'A-Different-Password-9' });

    const users = await select<{ password_hash: string }>(
      'SELECT c.password_hash FROM users u JOIN user_credentials c ON c.user_id = u.id',
    );
    expect(users).toHaveLength(1);
    expect(
      await new ScryptPasswordHasher().verify(superUser.password, users[0].password_hash),
    ).toBe(true);
    expect(await select('SELECT 1 FROM roles')).toHaveLength(2);
  });

  it('should read the super user from the environment and refuse a short password', () => {
    expect(superUserFromEnv({})).toBeNull();
    expect(
      superUserFromEnv({
        PLATFORM_SUPER_USER_EMAIL: ' A@Example.com ',
        PLATFORM_SUPER_USER_PASSWORD: 'long-enough-pass',
      }),
    ).toEqual({
      email: 'a@example.com',
      password: 'long-enough-pass',
      firstName: 'Platform',
      lastName: 'Owner',
    });
    expect(() =>
      superUserFromEnv({
        PLATFORM_SUPER_USER_EMAIL: 'a@example.com',
        PLATFORM_SUPER_USER_PASSWORD: 'short',
      }),
    ).toThrow('PLATFORM_SUPER_USER_PASSWORD must be at least 12 characters.');
  });
});
