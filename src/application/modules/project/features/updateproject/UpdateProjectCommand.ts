import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateProjectRequest } from '../createproject/ProjectRequest';

export class UpdateProjectCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly changes: UpdateProjectRequest,
    public readonly meta: RequestMeta,
  ) {}
}
