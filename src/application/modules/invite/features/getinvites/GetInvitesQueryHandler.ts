import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PagedResult } from '@shared/utils/Pagination';
import {
  IInviteQueries,
  INVITE_QUERIES,
  InviteReadModel,
} from '@infrastructure/queries/abstraction/IInviteQueries';
import { requirePlatform } from '@application/common/Authorization';

import { GetInvitesQuery } from './GetInvitesQuery';

@QueryHandler(GetInvitesQuery)
export class GetInvitesQueryHandler implements IQueryHandler<
  GetInvitesQuery,
  PagedResult<InviteReadModel>
> {
  constructor(@Inject(INVITE_QUERIES) private readonly invites: IInviteQueries) {}

  async execute(query: GetInvitesQuery): Promise<PagedResult<InviteReadModel>> {
    requirePlatform(query.actor);
    const { rows, total } = await this.invites.findList(query.filter);
    return PagedResult.of(rows, query.filter, total);
  }
}
