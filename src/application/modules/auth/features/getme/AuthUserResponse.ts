import { ApiProperty } from '@nestjs/swagger';

import { AuthUserReadModel } from '@infrastructure/queries/abstraction/IAuthQueries';

class OrganizationRefResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Skyline Developers' }) name!: string;
  @ApiProperty({ example: 'skyline' }) slug!: string;
  @ApiProperty({ enum: ['active', 'suspended'] }) status!: string;
}

/** The frontend's `AuthUser`. */
export class AuthUserResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'owner@skyline.example.com' }) email!: string;
  @ApiProperty({ example: 'Sara' }) firstName!: string;
  @ApiProperty({ example: 'Khan' }) lastName!: string;
  @ApiProperty({ enum: ['platform', 'tenant'] }) plane!: 'platform' | 'tenant';
  @ApiProperty({ type: [String], example: ['developer_super_user'] }) roles!: string[];
  @ApiProperty() isSuperUser!: boolean;
  @ApiProperty({ type: OrganizationRefResponse, nullable: true })
  organization!: OrganizationRefResponse | null;
  @ApiProperty() mustResetPassword!: boolean;
  @ApiProperty({ type: [String], example: ['projects.view'] }) permissions!: string[];
  @ApiProperty({ nullable: true, enum: ['owner', 'admin', 'department_head', 'member'] }) level!:
    string | null;

  static from(user: AuthUserReadModel): AuthUserResponse {
    return Object.assign(new AuthUserResponse(), user);
  }
}
