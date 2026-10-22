import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ITenantUserQueries,
  TENANT_USER_QUERIES,
} from '@infrastructure/queries/abstraction/ITenantUserQueries';
import { requirePermission } from '@application/common/Authorization';

import { userNotFound } from '../../TenantUserRules';
import { GetTenantUserQuery } from './GetTenantUserQuery';
import { TenantUserResponse } from './TenantUserResponse';

@QueryHandler(GetTenantUserQuery)
export class GetTenantUserQueryHandler implements IQueryHandler<
  GetTenantUserQuery,
  TenantUserResponse
> {
  constructor(@Inject(TENANT_USER_QUERIES) private readonly tenantUsers: ITenantUserQueries) {}

  async execute(query: GetTenantUserQuery): Promise<TenantUserResponse> {
    const organizationId = requirePermission(query.actor, 'users.view');
    const user = await this.tenantUsers.findById(organizationId, query.id);
    if (!user) throw userNotFound();
    return TenantUserResponse.from(user);
  }
}
