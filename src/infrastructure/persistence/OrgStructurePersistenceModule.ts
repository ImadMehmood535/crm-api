import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { DepartmentModel } from '@domain/aggregates/DepartmentAggregate/DepartmentModel';
import { TeamMemberModel } from '@domain/aggregates/TeamAggregate/TeamMemberModel';
import { TeamModel } from '@domain/aggregates/TeamAggregate/TeamModel';

import { ORG_STRUCTURE_QUERIES } from '../queries/abstraction/IOrgStructureQueries';
import { OrgStructureQueries } from '../queries/OrgStructureQueries';
import { DEPARTMENT_REPOSITORY } from '../repositories/abstraction/IDepartmentRepository';
import { TEAM_REPOSITORY } from '../repositories/abstraction/ITeamRepository';
import { DepartmentRepository } from '../repositories/DepartmentRepository';
import { TeamRepository } from '../repositories/TeamRepository';

@Module({
  imports: [SequelizeModule.forFeature([DepartmentModel, TeamModel, TeamMemberModel])],
  providers: [
    { provide: DEPARTMENT_REPOSITORY, useClass: DepartmentRepository },
    { provide: TEAM_REPOSITORY, useClass: TeamRepository },
    { provide: ORG_STRUCTURE_QUERIES, useClass: OrgStructureQueries },
  ],
  exports: [DEPARTMENT_REPOSITORY, TEAM_REPOSITORY, ORG_STRUCTURE_QUERIES],
})
export class OrgStructurePersistenceModule {}
