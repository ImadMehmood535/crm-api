import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { IRbacQueries, RBAC_QUERIES } from '@infrastructure/queries/abstraction/IRbacQueries';
import { requirePermission } from '@application/common/Authorization';

import { GetPermissionsQuery } from './GetPermissionsQuery';
import { PermissionModuleResponse } from './PermissionModuleResponse';

@QueryHandler(GetPermissionsQuery)
export class GetPermissionsQueryHandler implements IQueryHandler<
  GetPermissionsQuery,
  PermissionModuleResponse[]
> {
  constructor(@Inject(RBAC_QUERIES) private readonly rbac: IRbacQueries) {}

  async execute(query: GetPermissionsQuery): Promise<PermissionModuleResponse[]> {
    requirePermission(query.actor, 'roles.view');
    return this.rbac.catalogue();
  }
}
