import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateBrandingRequest } from './UpdateBrandingRequest';

export class UpdateBrandingCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly colors: UpdateBrandingRequest,
    public readonly meta: RequestMeta,
  ) {}
}
