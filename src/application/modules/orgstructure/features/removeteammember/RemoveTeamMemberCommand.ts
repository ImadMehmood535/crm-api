import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export class RemoveTeamMemberCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly teamId: string,
    public readonly userId: string,
    public readonly meta: RequestMeta,
  ) {}
}
