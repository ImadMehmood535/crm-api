import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

export class GetPermissionsQuery implements IQuery {
  constructor(public readonly actor: Actor) {}
}
