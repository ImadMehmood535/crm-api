import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

export class GetUnitQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
  ) {}
}
