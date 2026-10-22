import { User } from '@domain/aggregates/UserAggregate/User';

import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface Credential {
  readonly passwordHash: string;
  readonly mustResetPassword: boolean;
}

export interface IUserRepository {
  /** Inserts the user and their credential; returns the user with its id. */
  save(user: User, passwordHash: string, mustReset: boolean, tx?: Tx): Promise<User>;
  update(user: User, tx?: Tx): Promise<void>;
  assignRole(userId: string, roleId: string, assignedBy: string | null, tx?: Tx): Promise<void>;
  emailExists(email: string): Promise<boolean>;
  /** Active platform super users other than `exceptUserId`. */
  countOtherActivePlatformSuperUsers(exceptUserId: string): Promise<number>;
  findById(id: string): Promise<User | null>;
  /** A user of this company only (another company's user is "not found"). */
  findTenantUser(organizationId: string, id: string): Promise<User | null>;
  replaceRoles(
    userId: string,
    roleIds: readonly string[],
    assignedBy: string,
    tx?: Tx,
  ): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  findCredential(userId: string): Promise<Credential | null>;
  setPassword(userId: string, passwordHash: string, mustReset: boolean, tx?: Tx): Promise<void>;
  markLoggedIn(userId: string): Promise<void>;
}
