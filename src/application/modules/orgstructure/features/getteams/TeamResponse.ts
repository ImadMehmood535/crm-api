import { ApiProperty } from '@nestjs/swagger';

import {
  PersonReadModel,
  TeamReadModel,
} from '@infrastructure/queries/abstraction/IOrgStructureQueries';

import { PersonResponse } from '../getdepartments/DepartmentResponse';

class TeamDepartmentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

/** The frontend's `Team`. */
export class TeamResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Payables' }) name!: string;
  @ApiProperty({ type: TeamDepartmentResponse }) department!: TeamDepartmentResponse;
  @ApiProperty({ type: [PersonResponse] }) members!: PersonReadModel[];
  @ApiProperty() createdAt!: string;

  static from(team: TeamReadModel): TeamResponse {
    return Object.assign(new TeamResponse(), team);
  }
}
