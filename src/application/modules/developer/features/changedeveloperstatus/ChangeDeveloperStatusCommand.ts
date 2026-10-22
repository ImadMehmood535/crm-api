import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export type DeveloperStatusChange = 'suspend' | 'reactivate';

export class ChangeDeveloperStatusCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly change: DeveloperStatusChange,
    public readonly meta: RequestMeta,
  ) {}
}
