import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetTeamsRequest } from './GetTeamsRequest';

export class GetTeamsQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetTeamsRequest,
  ) {}
}
