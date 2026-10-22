import { ICommand } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

export class LogoutCommand implements ICommand {
  constructor(public readonly actor: Actor) {}
}
