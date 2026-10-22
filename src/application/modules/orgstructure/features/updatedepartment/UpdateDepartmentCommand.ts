import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

import { UpdateDepartmentRequest } from '../createdepartment/DepartmentRequest';

export class UpdateDepartmentCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly id: string,
    public readonly changes: UpdateDepartmentRequest,
    public readonly meta: RequestMeta,
  ) {}
}
