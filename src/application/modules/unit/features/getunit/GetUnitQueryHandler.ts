import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  IInventoryQueries,
  INVENTORY_QUERIES,
} from '@infrastructure/queries/abstraction/IInventoryQueries';
import { requirePermission } from '@application/common/Authorization';

import { unitNotFound } from '../../UnitRules';
import { GetUnitQuery } from './GetUnitQuery';
import { UnitResponse } from './UnitResponse';

@QueryHandler(GetUnitQuery)
export class GetUnitQueryHandler implements IQueryHandler<GetUnitQuery, UnitResponse> {
  constructor(@Inject(INVENTORY_QUERIES) private readonly inventory: IInventoryQueries) {}

  async execute(query: GetUnitQuery): Promise<UnitResponse> {
    const organizationId = requirePermission(query.actor, 'units.view');
    const unit = await this.inventory.findUnit(organizationId, query.id);
    if (!unit) throw unitNotFound();
    return UnitResponse.from(unit);
  }
}
