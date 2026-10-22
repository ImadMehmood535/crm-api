import { User } from '@domain/aggregates/UserAggregate/User';

import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface Credential {
  readonly passwordHash: string;
  readonly mustResetPassword: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findCredential(userId: string): Promise<Credential | null>;
  setPassword(userId: string, passwordHash: string, mustReset: boolean, tx?: Tx): Promise<void>;
  markLoggedIn(userId: string): Promise<void>;
}
