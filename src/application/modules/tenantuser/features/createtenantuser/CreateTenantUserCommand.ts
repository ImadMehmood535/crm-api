import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreateTenantUserRequest } from './CreateTenantUserRequest';

export class CreateTenantUserCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly user: CreateTenantUserRequest,
    public readonly meta: RequestMeta,
  ) {}
}
