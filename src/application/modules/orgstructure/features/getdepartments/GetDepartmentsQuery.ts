import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';
import { PageQuery } from '@application/common/PageQuery';

export class GetDepartmentsQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: PageQuery,
  ) {}
}
