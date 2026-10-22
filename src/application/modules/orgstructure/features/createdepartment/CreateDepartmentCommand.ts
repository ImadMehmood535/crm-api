import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { CreateDepartmentRequest } from './DepartmentRequest';

export class CreateDepartmentCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly department: CreateDepartmentRequest,
    public readonly meta: RequestMeta,
  ) {}
}
