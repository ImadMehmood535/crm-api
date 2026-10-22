import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { OrgStructurePersistenceModule } from '@infrastructure/persistence/OrgStructurePersistenceModule';
import { TenantPersistenceModule } from '@infrastructure/persistence/TenantPersistenceModule';

import { ChangeTenantUserStatusCommandHandler } from './features/changetenantuserstatus/ChangeTenantUserStatusCommandHandler';
import { CreateTenantUserCommandHandler } from './features/createtenantuser/CreateTenantUserCommandHandler';
import { GetTenantUserQueryHandler } from './features/gettenantuser/GetTenantUserQueryHandler';
import { GetTenantUsersQueryHandler } from './features/gettenantusers/GetTenantUsersQueryHandler';
import { ResetTenantUserPasswordCommandHandler } from './features/resettenantuserpassword/ResetTenantUserPasswordCommandHandler';
import { UpdateTenantUserCommandHandler } from './features/updatetenantuser/UpdateTenantUserCommandHandler';

@Module({
  imports: [CqrsModule, TenantPersistenceModule, OrgStructurePersistenceModule],
  providers: [
    GetTenantUsersQueryHandler,
    GetTenantUserQueryHandler,
    CreateTenantUserCommandHandler,
    UpdateTenantUserCommandHandler,
    ChangeTenantUserStatusCommandHandler,
    ResetTenantUserPasswordCommandHandler,
  ],
})
export class TenantUserModule {}
