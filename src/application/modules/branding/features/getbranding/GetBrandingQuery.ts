import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

export class GetBrandingQuery implements IQuery {
  constructor(public readonly actor: Actor) {}
}
