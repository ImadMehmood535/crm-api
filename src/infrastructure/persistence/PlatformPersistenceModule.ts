import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { InviteModel } from '@domain/aggregates/InviteAggregate/InviteModel';
import { OrganizationModel } from '@domain/aggregates/OrganizationAggregate/OrganizationModel';
import { RoleModel } from '@domain/aggregates/RoleAggregate/RoleModel';
import { UserCredentialModel } from '@domain/aggregates/UserAggregate/UserCredentialModel';
import { UserModel } from '@domain/aggregates/UserAggregate/UserModel';
import { UserRoleModel } from '@domain/aggregates/UserAggregate/UserRoleModel';

import { AUDIT_QUERIES } from '../queries/abstraction/IAuditQueries';
import { DEVELOPER_QUERIES } from '../queries/abstraction/IDeveloperQueries';
import { INVITE_QUERIES } from '../queries/abstraction/IInviteQueries';
import { PLATFORM_ADMIN_QUERIES } from '../queries/abstraction/IPlatformAdminQueries';
import { PLATFORM_STATS_QUERIES } from '../queries/abstraction/IPlatformStatsQueries';
import { AuditQueries } from '../queries/AuditQueries';
import { DeveloperQueries } from '../queries/DeveloperQueries';
import { InviteQueries } from '../queries/InviteQueries';
import { PlatformAdminQueries } from '../queries/PlatformAdminQueries';
import { PlatformStatsQueries } from '../queries/PlatformStatsQueries';
import { INVITE_REPOSITORY } from '../repositories/abstraction/IInviteRepository';
import { ORGANIZATION_REPOSITORY } from '../repositories/abstraction/IOrganizationRepository';
import { ROLE_REPOSITORY } from '../repositories/abstraction/IRoleRepository';
import { InviteRepository } from '../repositories/InviteRepository';
import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { AuthPersistenceModule } from './AuthPersistenceModule';

/** Persistence for the platform console: companies, invites, roles, admins, stats and audit. */
@Module({
  imports: [
    AuthPersistenceModule,
    SequelizeModule.forFeature([
      OrganizationModel,
      UserModel,
      UserCredentialModel,
      UserRoleModel,
      RoleModel,
      InviteModel,
    ]),
  ],
  providers: [
    { provide: ORGANIZATION_REPOSITORY, useClass: OrganizationRepository },
    { provide: ROLE_REPOSITORY, useClass: RoleRepository },
    { provide: INVITE_REPOSITORY, useClass: InviteRepository },
    { provide: DEVELOPER_QUERIES, useClass: DeveloperQueries },
    { provide: INVITE_QUERIES, useClass: InviteQueries },
    { provide: PLATFORM_ADMIN_QUERIES, useClass: PlatformAdminQueries },
    { provide: PLATFORM_STATS_QUERIES, useClass: PlatformStatsQueries },
    { provide: AUDIT_QUERIES, useClass: AuditQueries },
  ],
  exports: [
    AuthPersistenceModule,
    ORGANIZATION_REPOSITORY,
    ROLE_REPOSITORY,
    INVITE_REPOSITORY,
    DEVELOPER_QUERIES,
    INVITE_QUERIES,
    PLATFORM_ADMIN_QUERIES,
    PLATFORM_STATS_QUERIES,
    AUDIT_QUERIES,
  ],
})
export class PlatformPersistenceModule {}
