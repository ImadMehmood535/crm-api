import { ApiProperty } from '@nestjs/swagger';

import { PermissionBreakdownReadModel } from '@infrastructure/queries/abstraction/ITenantUserQueries';

/** One user's permissions by source; `permissions` = (rolePermissions ∪ granted) − revoked. */
export class UserPermissionsResponse {
  @ApiProperty({ type: [String], description: "Codes the user's roles give" })
  rolePermissions!: string[];
  @ApiProperty({ type: [String], description: 'Codes added for this user only' })
  granted!: string[];
  @ApiProperty({ type: [String], description: 'Role codes removed for this user only' })
  revoked!: string[];
  @ApiProperty({ type: [String], description: 'The effective set' })
  permissions!: string[];

  static from(breakdown: PermissionBreakdownReadModel): UserPermissionsResponse {
    return Object.assign(new UserPermissionsResponse(), breakdown);
  }
}
