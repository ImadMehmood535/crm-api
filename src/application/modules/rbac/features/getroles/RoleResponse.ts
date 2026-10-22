import { ApiProperty } from '@nestjs/swagger';

import { RoleReadModel } from '@infrastructure/queries/abstraction/IRbacQueries';

/** The frontend's `Role`. The built-in owner role lists every permission. */
export class RoleResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'HR Assistant' }) name!: string;
  @ApiProperty({ example: 'hr_assistant' }) code!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ description: 'The built-in owner role: read-only, holds every permission' })
  isSystem!: boolean;
  @ApiProperty({ type: [String], example: ['users.view'] }) permissions!: string[];
  @ApiProperty() userCount!: number;
  @ApiProperty() createdAt!: string;

  static from(role: RoleReadModel): RoleResponse {
    return Object.assign(new RoleResponse(), role);
  }
}
