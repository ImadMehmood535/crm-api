import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PlatformPersistenceModule } from '@infrastructure/persistence/PlatformPersistenceModule';

import { ChangeDeveloperStatusCommandHandler } from './features/changedeveloperstatus/ChangeDeveloperStatusCommandHandler';
import { GetDeveloperQueryHandler } from './features/getdeveloper/GetDeveloperQueryHandler';
import { GetDevelopersQueryHandler } from './features/getdevelopers/GetDevelopersQueryHandler';
import { OnboardDeveloperCommandHandler } from './features/onboarddeveloper/OnboardDeveloperCommandHandler';

@Module({
  imports: [CqrsModule, PlatformPersistenceModule],
  providers: [
    GetDevelopersQueryHandler,
    GetDeveloperQueryHandler,
    OnboardDeveloperCommandHandler,
    ChangeDeveloperStatusCommandHandler,
  ],
})
export class DeveloperModule {}
