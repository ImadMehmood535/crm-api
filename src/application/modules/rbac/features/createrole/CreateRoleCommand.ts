import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreateRoleRequest } from './CreateRoleRequest';

export class CreateRoleCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly role: CreateRoleRequest,
    public readonly meta: RequestMeta,
  ) {}
}
