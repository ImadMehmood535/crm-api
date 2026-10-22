import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { TenantPersistenceModule } from '@infrastructure/persistence/TenantPersistenceModule';

import { CreateRoleCommandHandler } from './features/createrole/CreateRoleCommandHandler';
import { DeleteRoleCommandHandler } from './features/deleterole/DeleteRoleCommandHandler';
import { GetPermissionsQueryHandler } from './features/getpermissions/GetPermissionsQueryHandler';
import { GetRolesQueryHandler } from './features/getroles/GetRolesQueryHandler';
import { UpdateRoleCommandHandler } from './features/updaterole/UpdateRoleCommandHandler';

@Module({
  imports: [CqrsModule, TenantPersistenceModule],
  providers: [
    GetPermissionsQueryHandler,
    GetRolesQueryHandler,
    CreateRoleCommandHandler,
    UpdateRoleCommandHandler,
    DeleteRoleCommandHandler,
  ],
})
export class RbacModule {}
