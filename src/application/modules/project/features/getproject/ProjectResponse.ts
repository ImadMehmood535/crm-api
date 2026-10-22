import { ApiProperty } from '@nestjs/swagger';

import { ProjectReadModel } from '@infrastructure/queries/abstraction/IInventoryQueries';

class UnitCountsResponse {
  @ApiProperty() total!: number;
  @ApiProperty() available!: number;
  @ApiProperty() reserved!: number;
  @ApiProperty() sold!: number;
  @ApiProperty() blocked!: number;
}

/** The frontend's `Project`. */
export class ProjectResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Palm Heights' }) name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty({ enum: ['planning', 'active', 'completed', 'archived'] }) status!: string;
  @ApiProperty({ nullable: true, type: String, example: '2027-06-30' }) expectedCompletion!:
    string | null;
  @ApiProperty({ type: UnitCountsResponse }) unitCounts!: UnitCountsResponse;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(project: ProjectReadModel): ProjectResponse {
    return Object.assign(new ProjectResponse(), project);
  }
}
