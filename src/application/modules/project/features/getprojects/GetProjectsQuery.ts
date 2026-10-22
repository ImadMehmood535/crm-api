import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetProjectsRequest } from './GetProjectsRequest';

export class GetProjectsQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetProjectsRequest,
  ) {}
}
