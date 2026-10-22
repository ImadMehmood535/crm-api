import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export interface OwnerInput {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

export class OnboardDeveloperCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly name: string,
    public readonly slug: string,
    public readonly owner: OwnerInput,
    public readonly meta: RequestMeta,
  ) {}
}
