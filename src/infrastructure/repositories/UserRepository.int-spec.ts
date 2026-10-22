import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createRole, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { User } from '../../domain/aggregates/UserAggregate/User';
import { AuthPersistenceModule } from '../persistence/AuthPersistenceModule';
import { IUserRepository, USER_REPOSITORY } from './abstraction/IUserRepository';

describe('UserRepository', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let users: IUserRepository;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([AuthPersistenceModule]));
    users = moduleRef.get(USER_REPOSITORY);
  });

  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should find a user by email regardless of case and surrounding spaces', async () => {
    const id = await createUser(sequelize, { email: 'owner@example.com' });

    const user = await users.findByEmail('  Owner@Example.COM ');

    expect(user?.id).toBe(id);
    expect(user?.status).toBe('active');
  });

  it('should read and replace the credential', async () => {
    const id = await createUser(sequelize, { email: 'a@example.com', mustReset: true });

    await users.setPassword(id, 'new-hash', false);

    expect(await users.findCredential(id)).toEqual({
      passwordHash: 'new-hash',
      mustResetPassword: false,
    });
  });

  it('should stamp last_login_at', async () => {
    const id = await createUser(sequelize, { email: 'a@example.com' });

    await users.markLoggedIn(id);

    const [rows] = await sequelize.query('SELECT last_login_at FROM users WHERE id = :id', {
      replacements: { id },
    });
    expect((rows as { last_login_at: Date | null }[])[0].last_login_at).not.toBeNull();
  });
});

describe('UserRepository (writes)', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let users: IUserRepository;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([AuthPersistenceModule]));
    users = moduleRef.get(USER_REPOSITORY);
  });
  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should save a user with a must-reset credential and update their status', async () => {
    const saved = await users.save(
      User.createPlatformAdmin({
        email: 'Admin@Example.com',
        firstName: 'Ana',
        lastName: 'Lee',
        createdBy: null,
      }),
      'hash',
      true,
    );

    saved.deactivate();
    await users.update(saved);

    expect(await users.emailExists('admin@example.com')).toBe(true);
    expect(await users.findCredential(saved.id as string)).toEqual({
      passwordHash: 'hash',
      mustResetPassword: true,
    });
    expect((await users.findById(saved.id as string))?.status).toBe('inactive');
  });

  it('should count the other active platform super users', async () => {
    const role = await createRole(sequelize, { code: 'platform_super_user' });
    const a = await createUser(sequelize, { email: 'a@example.com', roleIds: [role] });
    await createUser(sequelize, { email: 'b@example.com', roleIds: [role], status: 'inactive' });
    const c = await createUser(sequelize, { email: 'c@example.com' });
    await users.assignRole(c, role, a);

    expect(await users.countOtherActivePlatformSuperUsers(a)).toBe(1);
  });
});
