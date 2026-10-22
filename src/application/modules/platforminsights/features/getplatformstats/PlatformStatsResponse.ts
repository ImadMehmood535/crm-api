import { ApiProperty } from '@nestjs/swagger';

import { PlatformStatsReadModel } from '@infrastructure/queries/abstraction/IPlatformStatsQueries';

class OrganizationCountsResponse {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() suspended!: number;
}

class TotalResponse {
  @ApiProperty() total!: number;
}

class CountsResponse {
  @ApiProperty({ type: OrganizationCountsResponse }) organizations!: OrganizationCountsResponse;
  @ApiProperty({ type: TotalResponse, description: 'Tenant users only' }) users!: TotalResponse;
  @ApiProperty({ type: TotalResponse }) projects!: TotalResponse;
  @ApiProperty({ type: TotalResponse }) units!: TotalResponse;
}

class ActivityResponse {
  @ApiProperty({
    enum: ['organization.created', 'organization.suspended', 'organization.reactivated'],
  })
  type!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty() organizationName!: string;
  @ApiProperty() at!: string;
  @ApiProperty({ nullable: true, type: String }) actorName!: string | null;
}

class TrendWeekResponse {
  @ApiProperty({ example: '2026-10-19', description: 'Monday of the ISO week' }) weekStart!: string;
  @ApiProperty() newOrganizations!: number;
  @ApiProperty() newUsers!: number;
}

class TrendsResponse {
  @ApiProperty({ type: [TrendWeekResponse] }) weeks!: TrendWeekResponse[];
}

export class PlatformStatsResponse {
  @ApiProperty({ type: CountsResponse }) counts!: CountsResponse;
  @ApiProperty({ type: [ActivityResponse] }) recentActivity!: ActivityResponse[];
  @ApiProperty({ type: TrendsResponse }) trends!: TrendsResponse;

  static from(stats: PlatformStatsReadModel): PlatformStatsResponse {
    return Object.assign(new PlatformStatsResponse(), stats);
  }
}
