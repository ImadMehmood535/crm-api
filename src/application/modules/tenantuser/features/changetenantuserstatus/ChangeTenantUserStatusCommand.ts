import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export type TenantUserStatusChange = 'activate' | 'deactivate';

export class ChangeTenantUserStatusCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly change: TenantUserStatusChange,
    public readonly meta: RequestMeta,
  ) {}
}
