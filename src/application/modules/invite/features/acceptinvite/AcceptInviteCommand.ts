import { ICommand } from '@nestjs/cqrs';

import { RequestMeta } from '@shared/auth/Actor';

import { AcceptInviteRequest } from './AcceptInviteRequest';

export class AcceptInviteCommand implements ICommand {
  constructor(
    public readonly token: string,
    public readonly body: AcceptInviteRequest,
    public readonly meta: RequestMeta,
  ) {}
}
