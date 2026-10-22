import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateTeamRequest } from '../createteam/TeamRequest';

export class UpdateTeamCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly changes: UpdateTeamRequest,
    public readonly meta: RequestMeta,
  ) {}
}
