import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CheckHealthQueryHandler } from './features/checkhealth/CheckHealthQueryHandler';

@Module({
  imports: [CqrsModule],
  providers: [CheckHealthQueryHandler],
})
export class HealthModule {}
