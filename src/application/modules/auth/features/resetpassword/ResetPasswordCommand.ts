import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export class ResetPasswordCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly currentPassword: string,
    public readonly newPassword: string,
    public readonly meta: RequestMeta,
  ) {}
}
