import {
  META,
  accessTokens,
  account,
  actor,
  authQueries,
  passwordHasher,
  refreshTokens,
  sessionRepository,
  userRepository,
} from '../../../../../../test/support/auth-mocks';
import { IUnitOfWork } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { ValidationFailedError } from '@shared/errors/AppError';

import { SessionIssuer } from '../../SessionIssuer';
import { ResetPasswordCommand } from './ResetPasswordCommand';
import { ResetPasswordCommandHandler } from './ResetPasswordCommandHandler';

describe('ResetPasswordCommandHandler', () => {
  const unitOfWork: IUnitOfWork = { run: (work) => work({}) };

  const setup = () => {
    const users = userRepository();
    users.findCredential.mockResolvedValue({ passwordHash: 'stored', mustResetPassword: true });
    const sessions = sessionRepository();
    const hasher = passwordHasher('Temp-Password-123');
    const handler = new ResetPasswordCommandHandler(
      users,
      sessions,
      authQueries(account()),
      hasher,
      unitOfWork,
      new SessionIssuer(sessions, refreshTokens(), accessTokens()),
    );
    return { handler, users, sessions };
  };

  it('should set the password, clear must-reset, revoke every session and open a new one', async () => {
    const { handler, users, sessions } = setup();

    const result = await handler.execute(
      new ResetPasswordCommand(actor(), 'Temp-Password-123', 'Brand-New-Password-1', META),
    );

    expect(users.setPassword).toHaveBeenCalledWith('user-1', 'hashed', false, {});
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'password_changed', {});
    expect(sessions.create).toHaveBeenCalled();
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('should answer INVALID_CREDENTIALS for a wrong current password', async () => {
    const { handler, users } = setup();

    await expect(
      handler.execute(
        new ResetPasswordCommand(actor(), 'Wrong-Password-12', 'Brand-New-Password-1', META),
      ),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(users.setPassword).not.toHaveBeenCalled();
  });

  it('should refuse a new password equal to the current one on newPassword', async () => {
    const { handler } = setup();

    const act = handler.execute(
      new ResetPasswordCommand(actor(), 'Temp-Password-123', 'Temp-Password-123', META),
    );

    await expect(act).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(act).rejects.toMatchObject({
      details: [
        { field: 'newPassword', messages: ['New password must differ from the current one.'] },
      ],
    });
  });
});
