import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreateTeamRequest } from './TeamRequest';

export class CreateTeamCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly team: CreateTeamRequest,
    public readonly meta: RequestMeta,
  ) {}
}
