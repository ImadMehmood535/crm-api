import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UnauthenticatedError } from '@shared/errors/AppError';
import { AUTH_QUERIES, IAuthQueries } from '@infrastructure/queries/abstraction/IAuthQueries';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@infrastructure/security/abstraction/IPasswordHasher';

import { assertCanAuthenticate } from '../../AccessPolicy';
import { SessionIssuer } from '../../SessionIssuer';
import { AuthSessionResponse } from './AuthSessionResponse';
import { LoginCommand } from './LoginCommand';

export const invalidCredentials = (message = 'Invalid email or password'): UnauthenticatedError =>
  new UnauthenticatedError(message, 'INVALID_CREDENTIALS');

@CommandHandler(LoginCommand)
export class LoginCommandHandler implements ICommandHandler<LoginCommand, AuthSessionResponse> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(AUTH_QUERIES) private readonly authQueries: IAuthQueries,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: LoginCommand): Promise<AuthSessionResponse> {
    const user = await this.users.findByEmail(command.email);
    if (!user) {
      await this.hasher.dummyVerify(command.password); // same latency as a wrong password
      throw invalidCredentials();
    }
    const userId = user.id as string; // loaded users always have an id
    const credential = await this.users.findCredential(userId);
    if (!credential || !(await this.hasher.verify(command.password, credential.passwordHash))) {
      throw invalidCredentials();
    }
    const account = await this.authQueries.findAccount(userId);
    if (!account) throw invalidCredentials();
    // Only now, after a correct password, may the account's state be revealed.
    assertCanAuthenticate(account.userStatus, account.organizationStatus);

    const session = await this.sessionIssuer.start(account.user, command.meta);
    await this.users.markLoggedIn(userId);
    return session;
  }
}
