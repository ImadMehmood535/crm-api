import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

import { GetAuditLogRequest } from './GetAuditLogRequest';

export class GetAuditLogQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly filter: GetAuditLogRequest,
  ) {}
}
