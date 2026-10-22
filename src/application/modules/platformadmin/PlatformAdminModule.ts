import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PlatformPersistenceModule } from '@infrastructure/persistence/PlatformPersistenceModule';

import { CreatePlatformAdminCommandHandler } from './features/createplatformadmin/CreatePlatformAdminCommandHandler';
import { DeactivatePlatformAdminCommandHandler } from './features/deactivateplatformadmin/DeactivatePlatformAdminCommandHandler';
import { GetPlatformAdminsQueryHandler } from './features/getplatformadmins/GetPlatformAdminsQueryHandler';

@Module({
  imports: [CqrsModule, PlatformPersistenceModule],
  providers: [
    GetPlatformAdminsQueryHandler,
    CreatePlatformAdminCommandHandler,
    DeactivatePlatformAdminCommandHandler,
  ],
})
export class PlatformAdminModule {}
