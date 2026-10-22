import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateTenantUserRequest } from './UpdateTenantUserRequest';

export class UpdateTenantUserCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly changes: UpdateTenantUserRequest,
    public readonly meta: RequestMeta,
  ) {}
}
