import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UnauthenticatedError, ValidationFailedError } from '@shared/errors/AppError';
import { IUnitOfWork, UNIT_OF_WORK } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { AUTH_QUERIES, IAuthQueries } from '@infrastructure/queries/abstraction/IAuthQueries';
import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@infrastructure/repositories/abstraction/IUserRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@infrastructure/security/abstraction/IPasswordHasher';

import { SessionIssuer } from '../../SessionIssuer';
import { invalidCredentials } from '../login/LoginCommandHandler';
import { AuthSessionResponse } from '../login/AuthSessionResponse';
import { ResetPasswordCommand } from './ResetPasswordCommand';

/** New password, must-reset cleared, every session revoked, a fresh session returned. */
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordCommandHandler implements ICommandHandler<
  ResetPasswordCommand,
  AuthSessionResponse
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(AUTH_QUERIES) private readonly authQueries: IAuthQueries,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<AuthSessionResponse> {
    const { userId } = command.actor;
    const credential = await this.users.findCredential(userId);
    if (
      !credential ||
      !(await this.hasher.verify(command.currentPassword, credential.passwordHash))
    ) {
      throw invalidCredentials('Current password is incorrect.');
    }
    if (command.newPassword === command.currentPassword) {
      throw ValidationFailedError.forField(
        'newPassword',
        'New password must differ from the current one.',
      );
    }
    const hash = await this.hasher.hash(command.newPassword);
    await this.unitOfWork.run(async (tx) => {
      await this.users.setPassword(userId, hash, false, tx);
      await this.sessions.revokeAllForUser(userId, 'password_changed', tx);
    });
    const account = await this.authQueries.findAccount(userId);
    if (!account) throw new UnauthenticatedError();
    return this.sessionIssuer.start(account.user, command.meta);
  }
}
