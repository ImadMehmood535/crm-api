import { ApiProperty } from '@nestjs/swagger';

import { InvitePreviewReadModel } from '@infrastructure/queries/abstraction/IInviteQueries';

export class InvitePreviewResponse {
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() organizationName!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() expiresAt!: string;

  static from(preview: InvitePreviewReadModel): InvitePreviewResponse {
    return Object.assign(new InvitePreviewResponse(), preview);
  }
}
