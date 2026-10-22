import { ApiProperty } from '@nestjs/swagger';

class PermissionActionResponse {
  @ApiProperty({ example: 'view' }) action!: string;
  @ApiProperty({ example: 'View users' }) label!: string;
  @ApiProperty({ example: 'users.view' }) code!: string;
}

/** One row of the permission matrix. */
export class PermissionModuleResponse {
  @ApiProperty({ example: 'users' }) module!: string;
  @ApiProperty({ example: 'Users' }) label!: string;
  @ApiProperty({ type: [PermissionActionResponse] }) actions!: PermissionActionResponse[];
}
