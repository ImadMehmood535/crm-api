import { META } from '../../../../../../test/support/auth-mocks';
import {
  inventoryQueries,
  projectRepository,
} from '../../../../../../test/support/inventory-mocks';
import { auditLog, unitOfWork } from '../../../../../../test/support/platform-mocks';
import { owner, withPermissions } from '../../../../../../test/support/tenant-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { DeleteProjectCommand } from '../deleteproject/DeleteProjectCommand';
import { DeleteProjectCommandHandler } from '../deleteproject/DeleteProjectCommandHandler';
import { GetProjectQuery } from '../getproject/GetProjectQuery';
import { GetProjectQueryHandler } from '../getproject/GetProjectQueryHandler';
import { GetProjectsQuery } from '../getprojects/GetProjectsQuery';
import { GetProjectsQueryHandler } from '../getprojects/GetProjectsQueryHandler';
import { UpdateProjectCommand } from '../updateproject/UpdateProjectCommand';
import { UpdateProjectCommandHandler } from '../updateproject/UpdateProjectCommandHandler';
import { CreateProjectCommand } from './CreateProjectCommand';
import { CreateProjectCommandHandler } from './CreateProjectCommandHandler';

describe('Project handlers', () => {
  const setup = () => {
    const projects = projectRepository();
    const queries = inventoryQueries();
    const audit = auditLog();
    return {
      projects,
      queries,
      audit,
      create: new CreateProjectCommandHandler(projects, queries, audit, unitOfWork),
      update: new UpdateProjectCommandHandler(projects, queries, audit, unitOfWork),
      remove: new DeleteProjectCommandHandler(projects, audit, unitOfWork),
      list: new GetProjectsQueryHandler(queries),
      get: new GetProjectQueryHandler(queries),
    };
  };

  it('should create for the caller company with defaults and audit it', async () => {
    const { create, projects, audit } = setup();

    await create.execute(
      new CreateProjectCommand(owner, { name: 'Palm Heights', currency: 'pkr' }, META),
    );

    expect(projects.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        currency: 'PKR',
        status: 'planning',
        nameKey: 'palm heights',
      }),
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.created' }),
      {},
    );
  });

  it('should answer PROJECT_NAME_CONFLICT on create and rename', async () => {
    const { create, update, projects } = setup();
    projects.nameKeyExists.mockResolvedValue(true);

    await expect(
      create.execute(new CreateProjectCommand(owner, { name: 'Palm Heights' }, META)),
    ).rejects.toMatchObject({
      code: 'PROJECT_NAME_CONFLICT',
    });
    await expect(
      update.execute(new UpdateProjectCommand(owner, 'p1', { name: 'Dup' }, META)),
    ).rejects.toMatchObject({
      code: 'PROJECT_NAME_CONFLICT',
    });
  });

  it('should patch only the given fields and keep currency/status when null is sent', async () => {
    const { update, projects } = setup();

    await update.execute(
      new UpdateProjectCommand(
        owner,
        'p1',
        { city: null, status: 'active', currency: undefined },
        META,
      ),
    );

    expect(projects.update).toHaveBeenCalledWith(
      expect.objectContaining({ city: null, status: 'active', currency: 'PKR' }),
      {},
    );
  });

  it('should refuse deleting a project with units and answer NOT_FOUND for unknown ids', async () => {
    const { remove, projects } = setup();
    projects.hasUnits.mockResolvedValueOnce(true);
    await expect(remove.execute(new DeleteProjectCommand(owner, 'p1', META))).rejects.toMatchObject(
      { code: 'PROJECT_HAS_UNITS' },
    );

    expect(await remove.execute(new DeleteProjectCommand(owner, 'p1', META))).toBeNull();
    projects.findById.mockResolvedValue(null);
    await expect(remove.execute(new DeleteProjectCommand(owner, 'x', META))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('should check the matching permission on every operation', async () => {
    const { create, update, remove, list, get, queries } = setup();
    const viewer = withPermissions('projects.view');

    await expect(
      create.execute(new CreateProjectCommand(viewer, { name: 'Ab' }, META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      update.execute(new UpdateProjectCommand(viewer, 'p1', {}, META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      remove.execute(new DeleteProjectCommand(viewer, 'p1', META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(
      (await list.execute(new GetProjectsQuery(viewer, { page: 1, pageSize: 20 }))).meta.total,
    ).toBe(1);
    expect(queries.findProjects).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      organizationId: 'org-1',
    });
    queries.findProject.mockResolvedValue(null);
    await expect(get.execute(new GetProjectQuery(viewer, 'x'))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
