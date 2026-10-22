import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from '@application/modules/auth/AuthModule';
import { BrandingModule } from '@application/modules/branding/BrandingModule';
import { DeveloperModule } from '@application/modules/developer/DeveloperModule';
import { HealthModule } from '@application/modules/health/HealthModule';
import { InviteModule } from '@application/modules/invite/InviteModule';
import { PlatformAdminModule } from '@application/modules/platformadmin/PlatformAdminModule';
import { PlatformInsightsModule } from '@application/modules/platforminsights/PlatformInsightsModule';
import { ProjectModule } from '@application/modules/project/ProjectModule';
import { RbacModule } from '@application/modules/rbac/RbacModule';
import { TenantUserModule } from '@application/modules/tenantuser/TenantUserModule';
import { UnitModule } from '@application/modules/unit/UnitModule';

import { AuthController } from './controllers/AuthController';
import { BrandingAssetsController } from './controllers/BrandingAssetsController';
import { BrandingController } from './controllers/BrandingController';
import { HealthController } from './controllers/HealthController';
import { PlatformAdminsController } from './controllers/PlatformAdminsController';
import { PlatformDevelopersController } from './controllers/PlatformDevelopersController';
import { PlatformInsightsController } from './controllers/PlatformInsightsController';
import { PlatformInvitesController } from './controllers/PlatformInvitesController';
import { PermissionsController } from './controllers/PermissionsController';
import { ProjectsController } from './controllers/ProjectsController';
import { PublicInvitesController } from './controllers/PublicInvitesController';
import { RolesController } from './controllers/RolesController';
import { UnitsController } from './controllers/UnitsController';
import { UsersController } from './controllers/UsersController';
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
    RbacModule,
    TenantUserModule,
    BrandingModule,
    ProjectModule,
    UnitModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    PlatformDevelopersController,
    PlatformInvitesController,
    PublicInvitesController,
    PlatformAdminsController,
    PlatformInsightsController,
    PermissionsController,
    RolesController,
    UsersController,
    BrandingController,
    BrandingAssetsController,
    ProjectsController,
    UnitsController,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
