import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { UnauthenticatedError } from '@shared/errors/AppError';
import { AUTH_QUERIES, IAuthQueries } from '@infrastructure/queries/abstraction/IAuthQueries';

import { AuthUserResponse } from './AuthUserResponse';
import { GetMeQuery } from './GetMeQuery';

@QueryHandler(GetMeQuery)
export class GetMeQueryHandler implements IQueryHandler<GetMeQuery, AuthUserResponse> {
  constructor(@Inject(AUTH_QUERIES) private readonly authQueries: IAuthQueries) {}

  async execute(query: GetMeQuery): Promise<AuthUserResponse> {
    const account = await this.authQueries.findAccount(query.actor.userId);
    if (!account) throw new UnauthenticatedError();
    return AuthUserResponse.from(account.user);
  }
}
