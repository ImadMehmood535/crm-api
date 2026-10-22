import { ICommand } from '@nestjs/cqrs';

import { RequestMeta } from '@shared/auth/Actor';

export class LoginCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly meta: RequestMeta,
  ) {}
}
