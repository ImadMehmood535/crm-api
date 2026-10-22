import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from '@application/modules/auth/AuthModule';
import { HealthModule } from '@application/modules/health/HealthModule';

import { AuthController } from './controllers/AuthController';
import { HealthController } from './controllers/HealthController';
import { AuthGuard } from './guards/AuthGuard';
import { RequestLoggerMiddleware } from './middleware/RequestLoggerMiddleware';

@Module({
  imports: [HealthModule, AuthModule],
  controllers: [HealthController, AuthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
