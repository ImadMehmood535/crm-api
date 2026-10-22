import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreatePlatformAdminRequest } from './CreatePlatformAdminRequest';

export class CreatePlatformAdminCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly admin: CreatePlatformAdminRequest,
    public readonly meta: RequestMeta,
  ) {}
}
