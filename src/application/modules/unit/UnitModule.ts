import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { InventoryPersistenceModule } from '@infrastructure/persistence/InventoryPersistenceModule';

import { CreateUnitCommandHandler } from './features/createunit/CreateUnitCommandHandler';
import { DeleteUnitCommandHandler } from './features/deleteunit/DeleteUnitCommandHandler';
import { GetUnitQueryHandler } from './features/getunit/GetUnitQueryHandler';
import { GetUnitsQueryHandler } from './features/getunits/GetUnitsQueryHandler';
import { UpdateUnitCommandHandler } from './features/updateunit/UpdateUnitCommandHandler';

@Module({
  imports: [CqrsModule, InventoryPersistenceModule],
  providers: [
    GetUnitsQueryHandler,
    GetUnitQueryHandler,
    CreateUnitCommandHandler,
    UpdateUnitCommandHandler,
    DeleteUnitCommandHandler,
  ],
})
export class UnitModule {}
