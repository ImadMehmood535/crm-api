import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PlatformPersistenceModule } from '@infrastructure/persistence/PlatformPersistenceModule';

import { AuthModule } from '../auth/AuthModule';
import { AcceptInviteCommandHandler } from './features/acceptinvite/AcceptInviteCommandHandler';
import { GetInvitesQueryHandler } from './features/getinvites/GetInvitesQueryHandler';
import { IssueInviteCommandHandler } from './features/issueinvite/IssueInviteCommandHandler';
import { PreviewInviteQueryHandler } from './features/previewinvite/PreviewInviteQueryHandler';
import { ResendInviteCommandHandler } from './features/resendinvite/ResendInviteCommandHandler';
import { RevokeInviteCommandHandler } from './features/revokeinvite/RevokeInviteCommandHandler';

@Module({
  imports: [CqrsModule, PlatformPersistenceModule, AuthModule],
  providers: [
    GetInvitesQueryHandler,
    IssueInviteCommandHandler,
    ResendInviteCommandHandler,
    RevokeInviteCommandHandler,
    PreviewInviteQueryHandler,
    AcceptInviteCommandHandler,
  ],
})
export class InviteModule {}
