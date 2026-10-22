import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateRoleRequest } from './UpdateRoleRequest';

export class UpdateRoleCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly changes: UpdateRoleRequest,
    public readonly meta: RequestMeta,
  ) {}
}
