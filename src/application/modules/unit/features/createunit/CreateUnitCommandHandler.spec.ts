import { META } from '../../../../../../test/support/auth-mocks';
import {
  inventoryQueries,
  projectRepository,
  unitRepository,
} from '../../../../../../test/support/inventory-mocks';
import { auditLog, unitOfWork } from '../../../../../../test/support/platform-mocks';
import { owner, withPermissions } from '../../../../../../test/support/tenant-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { DeleteUnitCommand } from '../deleteunit/DeleteUnitCommand';
import { DeleteUnitCommandHandler } from '../deleteunit/DeleteUnitCommandHandler';
import { GetUnitQuery } from '../getunit/GetUnitQuery';
import { GetUnitQueryHandler } from '../getunit/GetUnitQueryHandler';
import { GetUnitsQuery } from '../getunits/GetUnitsQuery';
import { GetUnitsQueryHandler } from '../getunits/GetUnitsQueryHandler';
import { UpdateUnitCommand } from '../updateunit/UpdateUnitCommand';
import { UpdateUnitCommandHandler } from '../updateunit/UpdateUnitCommandHandler';
import { CreateUnitCommand } from './CreateUnitCommand';
import { CreateUnitCommandHandler } from './CreateUnitCommandHandler';

describe('Unit handlers', () => {
  const setup = () => {
    const projects = projectRepository();
    const units = unitRepository();
    const queries = inventoryQueries();
    const audit = auditLog();
    return {
      projects,
      units,
      queries,
      audit,
      create: new CreateUnitCommandHandler(projects, units, queries, audit, unitOfWork),
      update: new UpdateUnitCommandHandler(units, queries, audit, unitOfWork),
      remove: new DeleteUnitCommandHandler(units, audit, unitOfWork),
      list: new GetUnitsQueryHandler(queries),
      get: new GetUnitQueryHandler(queries),
    };
  };

  it('should create a unit in a project of the caller company', async () => {
    const { create, units, audit } = setup();

    await create.execute(
      new CreateUnitCommand(owner, 'p1', { number: 'A-10', type: 'villa', bedrooms: 4 }, META),
    );

    expect(units.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        projectId: 'p1',
        type: 'villa',
        numberSort: 'a-0000000010',
      }),
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unit.created' }),
      {},
    );
  });

  it('should answer NOT_FOUND for an unknown project and UNIT_NUMBER_CONFLICT for a taken number', async () => {
    const { create, projects, units } = setup();
    units.numberKeyExists.mockResolvedValueOnce(true);
    await expect(
      create.execute(new CreateUnitCommand(owner, 'p1', { number: 'A-1' }, META)),
    ).rejects.toMatchObject({
      code: 'UNIT_NUMBER_CONFLICT',
    });

    projects.findById.mockResolvedValue(null);
    await expect(
      create.execute(new CreateUnitCommand(owner, 'x', { number: 'A-1' }, META)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should patch only the given fields and keep the rest', async () => {
    const { update, units } = setup();

    await update.execute(new UpdateUnitCommand(owner, 'u1', { status: 'sold', price: 1000 }, META));

    expect(units.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sold', price: 1000, number: 'A-1', type: 'apartment' }),
      {},
    );
  });

  it('should refuse renumbering onto a taken number and delete units', async () => {
    const { update, remove, units } = setup();
    units.numberKeyExists.mockResolvedValueOnce(true);
    await expect(
      update.execute(new UpdateUnitCommand(owner, 'u1', { number: 'A-2' }, META)),
    ).rejects.toMatchObject({
      code: 'UNIT_NUMBER_CONFLICT',
    });

    expect(await remove.execute(new DeleteUnitCommand(owner, 'u1', META))).toBeNull();
    units.findById.mockResolvedValue(null);
    await expect(remove.execute(new DeleteUnitCommand(owner, 'x', META))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      update.execute(new UpdateUnitCommand(owner, 'x', {}, META)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should list units only for a visible project and check permissions', async () => {
    const { list, get, queries, create } = setup();
    const viewer = withPermissions('units.view');

    expect(
      (await list.execute(new GetUnitsQuery(viewer, 'p1', { page: 1, pageSize: 20 }))).meta.total,
    ).toBe(1);
    expect(queries.findUnits).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      organizationId: 'org-1',
      projectId: 'p1',
    });
    expect((await get.execute(new GetUnitQuery(viewer, 'u1'))).number).toBe('A-1');
    await expect(
      create.execute(new CreateUnitCommand(viewer, 'p1', { number: 'A-1' }, META)),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    queries.findProject.mockResolvedValue(null);
    await expect(
      list.execute(new GetUnitsQuery(viewer, 'x', { page: 1, pageSize: 20 })),
    ).rejects.toBeInstanceOf(NotFoundError);
    queries.findUnit.mockResolvedValue(null);
    await expect(get.execute(new GetUnitQuery(viewer, 'x'))).rejects.toBeInstanceOf(NotFoundError);
  });
});
