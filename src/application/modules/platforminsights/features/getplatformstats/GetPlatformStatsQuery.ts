import { IQuery } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';

export class GetPlatformStatsQuery implements IQuery {
  constructor(
    public readonly actor: Actor,
    public readonly weeks: number,
  ) {}
}
