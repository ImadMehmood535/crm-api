import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';
import { PageRequest } from '@shared/utils/Pagination';

export class GetPlatformAdminsQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly page: PageRequest,
  ) {}
}
