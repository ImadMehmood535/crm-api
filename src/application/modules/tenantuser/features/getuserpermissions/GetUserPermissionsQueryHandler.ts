import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import { requirePermission, viewerOf } from '@application/common/Authorization';

import { userNotFound } from '../../TenantUserRules';
import { GetUserPermissionsQuery } from './GetUserPermissionsQuery';
import { UserPermissionsResponse } from './UserPermissionsResponse';

@QueryHandler(GetUserPermissionsQuery)
export class GetUserPermissionsQueryHandler implements IQueryHandler<
  GetUserPermissionsQuery,
  UserPermissionsResponse
> {
  constructor(@Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries) {}

  async execute(query: GetUserPermissionsQuery): Promise<UserPermissionsResponse> {
    const organizationId = requirePermission(query.actor, 'users.view');
    const user = await this.tenantUsers.findById(organizationId, query.id, viewerOf(query.actor));
    if (!user) throw userNotFound();
    return UserPermissionsResponse.from(await this.tenantUsers.findPermissionBreakdown(user.id));
  }
}
