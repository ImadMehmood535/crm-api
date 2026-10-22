import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from '@application/modules/auth/AuthModule';
import { DeveloperModule } from '@application/modules/developer/DeveloperModule';
import { HealthModule } from '@application/modules/health/HealthModule';
import { InviteModule } from '@application/modules/invite/InviteModule';
import { PlatformAdminModule } from '@application/modules/platformadmin/PlatformAdminModule';
import { PlatformInsightsModule } from '@application/modules/platforminsights/PlatformInsightsModule';

import { AuthController } from './controllers/AuthController';
import { HealthController } from './controllers/HealthController';
import { PlatformAdminsController } from './controllers/PlatformAdminsController';
import { PlatformDevelopersController } from './controllers/PlatformDevelopersController';
import { PlatformInsightsController } from './controllers/PlatformInsightsController';
import { PlatformInvitesController } from './controllers/PlatformInvitesController';
import { PublicInvitesController } from './controllers/PublicInvitesController';
import { AuthGuard } from './guards/AuthGuard';
import { RequestLoggerMiddleware } from './middleware/RequestLoggerMiddleware';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    DeveloperModule,
    InviteModule,
    PlatformAdminModule,
    PlatformInsightsModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    PlatformDevelopersController,
    PlatformInvitesController,
    PublicInvitesController,
    PlatformAdminsController,
    PlatformInsightsController,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
