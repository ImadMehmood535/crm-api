import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreateProjectRequest } from './ProjectRequest';

export class CreateProjectCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly project: CreateProjectRequest,
    public readonly meta: RequestMeta,
  ) {}
}
