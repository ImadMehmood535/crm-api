import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export class DeleteUnitCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly meta: RequestMeta,
  ) {}
}
