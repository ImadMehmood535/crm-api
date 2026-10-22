import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  IInventoryQueries,
  INVENTORY_QUERIES,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import { requirePermission } from '@application/common/Authorization';

import { projectNotFound } from '../../ProjectRules';
import { GetProjectQuery } from './GetProjectQuery';
import { ProjectResponse } from './ProjectResponse';

@QueryHandler(GetProjectQuery)
export class GetProjectQueryHandler implements IQueryHandler<GetProjectQuery, ProjectResponse> {
  constructor(@Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries) {}

  async execute(query: GetProjectQuery): Promise<ProjectResponse> {
    const organizationId = requirePermission(query.actor, 'projects.view');
    const project = await this.inventory.findProject(organizationId, query.id);
    if (!project) throw projectNotFound();
    return ProjectResponse.from(project);
  }
}
