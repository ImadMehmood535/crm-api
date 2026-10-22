import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { IssueInviteRequest } from './IssueInviteRequest';

export class IssueInviteCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly invite: IssueInviteRequest,
    public readonly meta: RequestMeta,
  ) {}
}
