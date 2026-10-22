import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { ProjectModel } from '@domain/aggregates/ProjectAggregate/ProjectModel';
import { UnitModel } from '@domain/aggregates/UnitAggregate/UnitModel';

import { INVENTORY_QUERIES } from '../queries/abstraction/IInventoryQueries';
import { InventoryQueries } from '../queries/InventoryQueries';
import { PROJECT_REPOSITORY } from '../repositories/abstraction/IProjectRepository';
import { UNIT_REPOSITORY } from '../repositories/abstraction/IUnitRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { UnitRepository } from '../repositories/UnitRepository';

@Module({
  imports: [SequelizeModule.forFeature([ProjectModel, UnitModel])],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: ProjectRepository },
    { provide: UNIT_REPOSITORY, useClass: UnitRepository },
    { provide: INVENTORY_QUERIES, useClass: InventoryQueries },
  ],
  exports: [PROJECT_REPOSITORY, UNIT_REPOSITORY, INVENTORY_QUERIES],
})
export class InventoryPersistenceModule {}
