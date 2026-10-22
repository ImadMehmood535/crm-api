import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { hashToken } from '@shared/utils/SecureToken';
import { inviteInvalid } from '@domain/aggregates/InviteAggregate/Invite';
import { IInviteQueries, INVITE_QUERIES } from '@infrastructure/queries/abstraction/IInviteQueries';

import { InvitePreviewResponse } from './InvitePreviewResponse';
import { PreviewInviteQuery } from './PreviewInviteQuery';

/** Public. Every bad token (unknown, expired, used, revoked) is the same 404 INVITE_INVALID. */
@QueryHandler(PreviewInviteQuery)
export class PreviewInviteQueryHandler implements IQueryHandler<
  PreviewInviteQuery,
  InvitePreviewResponse
> {
  constructor(@Inject(INVITE_QUERIES) private readonly invites: IInviteQueries) {}

  async execute(query: PreviewInviteQuery): Promise<InvitePreviewResponse> {
    const preview = await this.invites.findLivePreview(hashToken(query.token));
    if (!preview) throw inviteInvalid();
    return InvitePreviewResponse.from(preview);
  }
}
