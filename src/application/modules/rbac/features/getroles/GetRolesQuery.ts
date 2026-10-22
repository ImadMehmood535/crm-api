import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetRolesRequest } from './GetRolesRequest';

export class GetRolesQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetRolesRequest,
  ) {}
}
