import { ApiProperty } from '@nestjs/swagger';

import { DeveloperReadModel } from '@infrastructure/queries/abstraction/IDeveloperQueries';

class DeveloperOwnerResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'owner@skyline.example.com' }) email!: string;
  @ApiProperty({ example: 'Sara Khan' }) name!: string;
}

/** The frontend's `Developer` (a company as the platform sees it). */
export class DeveloperResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Skyline Developers' }) name!: string;
  @ApiProperty({ example: 'skyline' }) slug!: string;
  @ApiProperty({ enum: ['active', 'suspended'] }) status!: 'active' | 'suspended';
  @ApiProperty() createdAt!: string;
  @ApiProperty({ description: 'All users of the company, owner included' }) userCount!: number;
  @ApiProperty({ type: DeveloperOwnerResponse, nullable: true })
  superUser!: DeveloperOwnerResponse | null;

  static from(developer: DeveloperReadModel): DeveloperResponse {
    return Object.assign(new DeveloperResponse(), developer);
  }
}
