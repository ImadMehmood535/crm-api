import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export class SetUserPermissionsCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly permissions: readonly string[],
    public readonly meta: RequestMeta,
  ) {}
}
