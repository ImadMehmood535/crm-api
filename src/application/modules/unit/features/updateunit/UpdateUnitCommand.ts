import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateUnitRequest } from '../createunit/UnitRequest';

export class UpdateUnitCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly changes: UpdateUnitRequest,
    public readonly meta: RequestMeta,
  ) {}
}
