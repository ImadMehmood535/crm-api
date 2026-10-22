import { Module } from '@nestjs/common';

import { RBAC_QUERIES } from '../queries/abstraction/IRbacQueries';
import { TENANT_USER_QUERIES } from '../queries/abstraction/ITenantUserQueries';
import { RbacQueries } from '../queries/RbacQueries';
import { TenantUserQueries } from '../queries/TenantUserQueries';
import { PlatformPersistenceModule } from './PlatformPersistenceModule';

/** Persistence for the tenant workspace: roles, permissions and company staff. */
@Module({
  imports: [PlatformPersistenceModule],
  providers: [
    { provide: RBAC_QUERIES, useClass: RbacQueries },
    { provide: TENANT_USER_QUERIES, useClass: TenantUserQueries },
  ],
  exports: [PlatformPersistenceModule, RBAC_QUERIES, TENANT_USER_QUERIES],
})
export class TenantPersistenceModule {}
