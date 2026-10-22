import { ApiProperty } from '@nestjs/swagger';

import {
  DepartmentReadModel,
  PersonReadModel,
} from '@infrastructure/queries/abstraction/IOrgStructureQueries';

export class PersonResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
}

/** The frontend's `Department`. */
export class DepartmentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Finance' }) name!: string;
  @ApiProperty({ type: PersonResponse, nullable: true }) head!: PersonReadModel | null;
  @ApiProperty() teamCount!: number;
  @ApiProperty() memberCount!: number;
  @ApiProperty() createdAt!: string;

  static from(department: DepartmentReadModel): DepartmentResponse {
    return Object.assign(new DepartmentResponse(), department);
  }
}
