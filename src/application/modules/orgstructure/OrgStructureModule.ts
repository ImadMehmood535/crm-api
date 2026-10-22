import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { OrgStructurePersistenceModule } from '@infrastructure/persistence/OrgStructurePersistenceModule';
import { TenantPersistenceModule } from '@infrastructure/persistence/TenantPersistenceModule';

import { AddTeamMemberCommandHandler } from './features/addteammember/AddTeamMemberCommandHandler';
import { CreateDepartmentCommandHandler } from './features/createdepartment/CreateDepartmentCommandHandler';
import { CreateTeamCommandHandler } from './features/createteam/CreateTeamCommandHandler';
import { DeleteDepartmentCommandHandler } from './features/deletedepartment/DeleteDepartmentCommandHandler';
import { DeleteTeamCommandHandler } from './features/deleteteam/DeleteTeamCommandHandler';
import { GetDepartmentsQueryHandler } from './features/getdepartments/GetDepartmentsQueryHandler';
import { GetTeamsQueryHandler } from './features/getteams/GetTeamsQueryHandler';
import { RemoveTeamMemberCommandHandler } from './features/removeteammember/RemoveTeamMemberCommandHandler';
import { UpdateDepartmentCommandHandler } from './features/updatedepartment/UpdateDepartmentCommandHandler';
import { UpdateTeamCommandHandler } from './features/updateteam/UpdateTeamCommandHandler';

@Module({
  imports: [CqrsModule, OrgStructurePersistenceModule, TenantPersistenceModule],
  providers: [
    GetDepartmentsQueryHandler,
    CreateDepartmentCommandHandler,
    UpdateDepartmentCommandHandler,
    DeleteDepartmentCommandHandler,
    GetTeamsQueryHandler,
    CreateTeamCommandHandler,
    UpdateTeamCommandHandler,
    DeleteTeamCommandHandler,
    AddTeamMemberCommandHandler,
    RemoveTeamMemberCommandHandler,
  ],
})
export class OrgStructureModule {}
