import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetUnitsRequest } from './GetUnitsRequest';

export class GetUnitsQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly projectId: string,
    public readonly filter: GetUnitsRequest,
  ) {}
}
