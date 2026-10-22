import { ApiProperty } from '@nestjs/swagger';

import { PlatformAdminReadModel } from '@infrastructure/queries/abstraction/IPlatformAdminQueries';

export class PlatformAdminResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ['platform_super_user', 'platform_admin'] })
  role!: PlatformAdminReadModel['role'];
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;

  static from(admin: PlatformAdminReadModel): PlatformAdminResponse {
    return Object.assign(new PlatformAdminResponse(), admin);
  }
}
