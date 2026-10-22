import { Session } from '../../src/domain/aggregates/SessionAggregate/Session';
import {
  AccountReadModel,
  IAuthQueries,
} from '../../src/infrastructure/queries/abstraction/IAuthQueries';
import { ISessionRepository } from '../../src/infrastructure/repositories/abstraction/ISessionRepository';
import { IUserRepository } from '../../src/infrastructure/repositories/abstraction/IUserRepository';
import { IAccessTokens } from '../../src/infrastructure/security/abstraction/IAccessTokens';
import { IPasswordHasher } from '../../src/infrastructure/security/abstraction/IPasswordHasher';
import { IRefreshTokens } from '../../src/infrastructure/security/abstraction/IRefreshTokens';
import { Actor } from '../../src/shared/auth/Actor';

export const META = { ipAddress: '10.0.0.1', userAgent: 'jest' };

export function account(overrides: Partial<AccountReadModel> = {}): AccountReadModel {
  return {
    userStatus: 'active',
    organizationStatus: 'active',
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      firstName: 'Sara',
      lastName: 'Khan',
      plane: 'tenant',
      roles: ['developer_super_user'],
      isSuperUser: true,
      organization: { id: 'org-1', name: 'Skyline', slug: 'skyline', status: 'active' },
      mustResetPassword: false,
      permissions: [],
    },
    ...overrides,
  };
}

export function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: 'user-1',
    sessionId: 'family-1',
    organizationId: 'org-1',
    plane: 'tenant',
    roles: ['developer_super_user'],
    permissions: [],
    isSuperUser: true,
    mustResetPassword: false,
    ...overrides,
  };
}

const future = new Date(Date.now() + 60_000);
export const activeSession = (): Session =>
  Session.rehydrate('s-1', 'user-1', 'family-1', future, null, null);
export const rotatedSession = (): Session =>
  Session.rehydrate('s-1', 'user-1', 'family-1', future, new Date(), 's-2');

export function userRepository(): jest.Mocked<IUserRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findCredential: jest.fn(),
    setPassword: jest.fn(),
    markLoggedIn: jest.fn(),
  };
}

export function sessionRepository(): jest.Mocked<ISessionRepository> {
  return {
    create: jest
      .fn()
      .mockImplementation((s: { familyId: string }) =>
        Promise.resolve(Session.rehydrate('s-new', 'user-1', s.familyId, future, null, null)),
      ),
    findById: jest.fn(),
    findByTokenHash: jest.fn(),
    rotate: jest.fn(),
    isFamilyActive: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
}

export function authQueries(found: AccountReadModel | null = account()): jest.Mocked<IAuthQueries> {
  return { findAccount: jest.fn().mockResolvedValue(found) };
}

export function passwordHasher(correct = 'Correct-Password-123'): jest.Mocked<IPasswordHasher> {
  return {
    hash: jest.fn().mockResolvedValue('hashed'),
    verify: jest.fn().mockImplementation((plain: string) => Promise.resolve(plain === correct)),
    dummyVerify: jest.fn().mockResolvedValue(false),
  };
}

export function refreshTokens(): jest.Mocked<IRefreshTokens> {
  return {
    issue: jest.fn().mockReturnValue({ token: 'new-refresh', hash: 'new-hash', expiresAt: future }),
    hashOf: jest.fn().mockImplementation((t: string) => `hash-of-${t}`),
  };
}

export function accessTokens(): jest.Mocked<IAccessTokens> {
  return {
    ttlSeconds: 900,
    sign: jest.fn().mockReturnValue('access-token'),
    verify: jest.fn().mockReturnValue({ userId: 'user-1', sessionId: 'family-1' }),
  };
}
