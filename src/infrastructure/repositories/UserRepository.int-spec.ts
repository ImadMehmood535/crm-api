import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
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
