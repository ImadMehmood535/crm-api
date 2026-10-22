import { ApiProperty } from '@nestjs/swagger';

import { PlatformAdminResponse } from '../getplatformadmins/PlatformAdminResponse';

export class CreatePlatformAdminResponse {
  @ApiProperty({ type: PlatformAdminResponse }) admin!: PlatformAdminResponse;
  @ApiProperty({ description: 'Shown once; must be changed at first login' })
  temporaryPassword!: string;

  static of(admin: PlatformAdminResponse, temporaryPassword: string): CreatePlatformAdminResponse {
    return Object.assign(new CreatePlatformAdminResponse(), { admin, temporaryPassword });
  }
}
