import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetInvitesRequest } from './GetInvitesRequest';

export class GetInvitesQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetInvitesRequest,
  ) {}
}
