import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  DATABASE_HEALTH,
  IDatabaseHealth,
} from '@infrastructure/persistence/abstraction/IDatabaseHealth';

import { CheckHealthQuery } from './CheckHealthQuery';
import { CheckHealthResponse } from './CheckHealthResponse';

@QueryHandler(CheckHealthQuery)
export class CheckHealthQueryHandler implements IQueryHandler<
  CheckHealthQuery,
  CheckHealthResponse
> {
  constructor(@Inject(DATABASE_HEALTH) private readonly database: IDatabaseHealth) {}

  async execute(): Promise<CheckHealthResponse> {
    return CheckHealthResponse.of(await this.database.isUp());
  }
}
