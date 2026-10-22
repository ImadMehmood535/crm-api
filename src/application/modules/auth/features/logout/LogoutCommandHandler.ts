import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';

import { LogoutCommand } from './LogoutCommand';

/** Ends the caller's login chain on this device. Other devices stay signed in. */
@CommandHandler(LogoutCommand)
export class LogoutCommandHandler implements ICommandHandler<LogoutCommand, null> {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository) {}

  async execute(command: LogoutCommand): Promise<null> {
    await this.sessions.revokeFamily(command.actor.sessionId, 'logout');
    return null;
  }
}
