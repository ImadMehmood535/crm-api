import { ICommand } from '@nestjs/cqrs';

import { RequestMeta } from '@shared/auth/Actor';

export class RefreshCommand implements ICommand {
  constructor(
    public readonly refreshToken: string,
    public readonly meta: RequestMeta,
  ) {}
}
