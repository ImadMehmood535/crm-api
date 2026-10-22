import { ApiProperty } from '@nestjs/swagger';

import { USER_LEVELS } from '@shared/auth/UserLevel';
import { TenantUserReadModel } from '@infrastructure/queries/abstraction/ITenantUserQueries';

class RoleSummaryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
}

class TeamSummaryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

/** The frontend's `TenantUser`. */
export class TenantUserResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ['active', 'inactive', 'suspended'] })
  status!: TenantUserReadModel['status'];
  @ApiProperty({ enum: USER_LEVELS, description: 'Decides who may create and see whom' })
  level!: TenantUserReadModel['level'];
  @ApiProperty({ description: "The company's owner: cannot be edited, deactivated or reset" })
  isOwner!: boolean;
  @ApiProperty({ type: [RoleSummaryResponse] }) roles!: RoleSummaryResponse[];
  @ApiProperty({ type: [TeamSummaryResponse] }) teams!: TeamSummaryResponse[];
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ nullable: true, type: String }) lastLoginAt!: string | null;
  @ApiProperty() createdAt!: string;

  static from(user: TenantUserReadModel): TenantUserResponse {
    return Object.assign(new TenantUserResponse(), user);
  }
}

export class TenantUserWithPasswordResponse {
  @ApiProperty({ type: TenantUserResponse }) user!: TenantUserResponse;
  @ApiProperty({ description: 'Shown once; must be changed at first login' })
  temporaryPassword!: string;

  static of(user: TenantUserReadModel, temporaryPassword: string): TenantUserWithPasswordResponse {
    return Object.assign(new TenantUserWithPasswordResponse(), {
      user: TenantUserResponse.from(user),
      temporaryPassword,
    });
  }
}
