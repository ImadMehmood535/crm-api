import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PlatformPersistenceModule } from '@infrastructure/persistence/PlatformPersistenceModule';

import { GetAuditLogQueryHandler } from './features/getauditlog/GetAuditLogQueryHandler';
import { GetPlatformStatsQueryHandler } from './features/getplatformstats/GetPlatformStatsQueryHandler';

@Module({
  imports: [CqrsModule, PlatformPersistenceModule],
  providers: [GetPlatformStatsQueryHandler, GetAuditLogQueryHandler],
})
export class PlatformInsightsModule {}
