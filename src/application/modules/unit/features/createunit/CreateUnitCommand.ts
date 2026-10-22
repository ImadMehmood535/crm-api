import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreateUnitRequest } from './UnitRequest';

export class CreateUnitCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly projectId: string,
    public readonly unit: CreateUnitRequest,
    public readonly meta: RequestMeta,
  ) {}
}
