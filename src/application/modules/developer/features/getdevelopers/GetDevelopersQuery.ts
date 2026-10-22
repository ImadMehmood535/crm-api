import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetDevelopersRequest } from './GetDevelopersRequest';

export class GetDevelopersQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetDevelopersRequest,
  ) {}
}
