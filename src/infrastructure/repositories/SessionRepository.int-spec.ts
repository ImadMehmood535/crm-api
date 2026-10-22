import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { uuidv7 } from '../../shared/utils/Uuid';
import { AuthPersistenceModule } from '../persistence/AuthPersistenceModule';
import {
  ISessionRepository,
  NewSession,
  SESSION_REPOSITORY,
} from './abstraction/ISessionRepository';

describe('SessionRepository', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let sessions: ISessionRepository;
  let userId: string;

  const next = (familyId: string, hash: string): NewSession => ({
    userId,
    familyId,
    refreshTokenHash: hash.padEnd(64, '0'),
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
  });

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([AuthPersistenceModule]));
    sessions = moduleRef.get(SESSION_REPOSITORY);
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    userId = await createUser(sequelize, { email: 'u@example.com' });
  });

  afterAll(() => moduleRef.close());

  it('should create a session and find it by its token hash', async () => {
    const created = await sessions.create(next(uuidv7(), 'a'));

    const found = await sessions.findByTokenHash('a'.padEnd(64, '0'));

    expect(found?.id).toBe(created.id);
    expect(found?.isActive()).toBe(true);
  });

  it('should rotate: the old session is replaced and the successor is active', async () => {
    const family = uuidv7();
    const first = await sessions.create(next(family, 'a'));

    const second = await sessions.rotate(first.id, next(family, 'b'));

    expect(second?.familyId).toBe(family);
    expect(second?.isActive()).toBe(true);
    const old = await sessions.findById(first.id);
    expect(old?.isRotated()).toBe(true);
  });

  it('should refuse the second of two concurrent rotations', async () => {
    const family = uuidv7();
    const first = await sessions.create(next(family, 'a'));

    const results = await Promise.all([
      sessions.rotate(first.id, next(family, 'b')),
      sessions.rotate(first.id, next(family, 'c')),
    ]);

    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it('should revoke every session of a family and leave other families alone', async () => {
    const family = uuidv7();
    const a = await sessions.create(next(family, 'a'));
    const other = await sessions.create(next(uuidv7(), 'z'));

    await sessions.revokeFamily(family, 'logout');

    expect((await sessions.findById(a.id))?.isActive()).toBe(false);
    expect((await sessions.findById(other.id))?.isActive()).toBe(true);
  });

  it('should keep a family active across rotation and end it on revoke', async () => {
    const family = uuidv7();
    const first = await sessions.create(next(family, 'a'));
    await sessions.rotate(first.id, next(family, 'b'));

    expect(await sessions.isFamilyActive(family, userId)).toBe(true);
    expect(await sessions.isFamilyActive(family, uuidv7())).toBe(false);

    await sessions.revokeFamily(family, 'logout');

    expect(await sessions.isFamilyActive(family, userId)).toBe(false);
  });

  it('should revoke all sessions of a user', async () => {
    const a = await sessions.create(next(uuidv7(), 'a'));
    const b = await sessions.create(next(uuidv7(), 'b'));

    await sessions.revokeAllForUser(userId, 'password_changed');

    expect((await sessions.findById(a.id))?.isActive()).toBe(false);
    expect((await sessions.findById(b.id))?.isActive()).toBe(false);
  });
});
