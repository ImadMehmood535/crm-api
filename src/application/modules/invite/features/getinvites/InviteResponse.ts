import { ApiProperty } from '@nestjs/swagger';

import { InviteReadModel } from '@infrastructure/queries/abstraction/IInviteQueries';

/** The frontend's `Invite`; `expired` is derived from a pending invite's expiry. */
export class InviteResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() organizationName!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ['pending', 'accepted', 'revoked', 'expired'] })
  status!: InviteReadModel['status'];
  @ApiProperty() expiresAt!: string;
  @ApiProperty() createdAt!: string;

  static from(invite: InviteReadModel): InviteResponse {
    return Object.assign(new InviteResponse(), invite);
  }
}
