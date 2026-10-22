import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { InventoryPersistenceModule } from '@infrastructure/persistence/InventoryPersistenceModule';

import { CreateProjectCommandHandler } from './features/createproject/CreateProjectCommandHandler';
import { DeleteProjectCommandHandler } from './features/deleteproject/DeleteProjectCommandHandler';
import { GetProjectQueryHandler } from './features/getproject/GetProjectQueryHandler';
import { GetProjectsQueryHandler } from './features/getprojects/GetProjectsQueryHandler';
import { UpdateProjectCommandHandler } from './features/updateproject/UpdateProjectCommandHandler';

@Module({
  imports: [CqrsModule, InventoryPersistenceModule],
  providers: [
    GetProjectsQueryHandler,
    GetProjectQueryHandler,
    CreateProjectCommandHandler,
    UpdateProjectCommandHandler,
    DeleteProjectCommandHandler,
  ],
})
export class ProjectModule {}
