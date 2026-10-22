import { actor, sessionRepository } from '../../../../../../test/support/auth-mocks';

import { LogoutCommand } from './LogoutCommand';
import { LogoutCommandHandler } from './LogoutCommandHandler';

describe('LogoutCommandHandler', () => {
  it("should revoke the caller's login chain and return null", async () => {
    const sessions = sessionRepository();

    const result = await new LogoutCommandHandler(sessions).execute(new LogoutCommand(actor()));

    expect(result).toBeNull();
    expect(sessions.revokeFamily).toHaveBeenCalledWith('family-1', 'logout');
  });
});
