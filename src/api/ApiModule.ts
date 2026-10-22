import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { HealthModule } from '@application/modules/health/HealthModule';

import { HealthController } from './controllers/HealthController';
import { RequestLoggerMiddleware } from './middleware/RequestLoggerMiddleware';

@Module({
  imports: [HealthModule],
  controllers: [HealthController],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
