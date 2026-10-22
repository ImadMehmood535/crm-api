import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetTenantUsersRequest } from './GetTenantUsersRequest';

export class GetTenantUsersQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetTenantUsersRequest,
  ) {}
}
