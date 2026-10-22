import { META } from '../../../../test/support/auth-mocks';
import {
  atLevel,
  department,
  departmentRepository,
  orgStructureQueries,
  teamRepository,
} from '../../../../test/support/org-mocks';
import { auditLog, unitOfWork } from '../../../../test/support/platform-mocks';
import {
  owner,
  tenantUserQueries,
  tenantUserReadModel,
  withPermissions,
} from '../../../../test/support/tenant-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { AddTeamMemberCommand } from './features/addteammember/AddTeamMemberCommand';
import { AddTeamMemberCommandHandler } from './features/addteammember/AddTeamMemberCommandHandler';
import { CreateDepartmentCommand } from './features/createdepartment/CreateDepartmentCommand';
import { CreateDepartmentCommandHandler } from './features/createdepartment/CreateDepartmentCommandHandler';
import { CreateTeamCommand } from './features/createteam/CreateTeamCommand';
import { CreateTeamCommandHandler } from './features/createteam/CreateTeamCommandHandler';
import { DeleteDepartmentCommand } from './features/deletedepartment/DeleteDepartmentCommand';
import { DeleteDepartmentCommandHandler } from './features/deletedepartment/DeleteDepartmentCommandHandler';
import { DeleteTeamCommand } from './features/deleteteam/DeleteTeamCommand';
import { DeleteTeamCommandHandler } from './features/deleteteam/DeleteTeamCommandHandler';
import { GetDepartmentsQuery } from './features/getdepartments/GetDepartmentsQuery';
import { GetDepartmentsQueryHandler } from './features/getdepartments/GetDepartmentsQueryHandler';
import { GetTeamsQuery } from './features/getteams/GetTeamsQuery';
import { GetTeamsQueryHandler } from './features/getteams/GetTeamsQueryHandler';
import { RemoveTeamMemberCommand } from './features/removeteammember/RemoveTeamMemberCommand';
import { RemoveTeamMemberCommandHandler } from './features/removeteammember/RemoveTeamMemberCommandHandler';
import { UpdateDepartmentCommand } from './features/updatedepartment/UpdateDepartmentCommand';
import { UpdateDepartmentCommandHandler } from './features/updatedepartment/UpdateDepartmentCommandHandler';
import { UpdateTeamCommand } from './features/updateteam/UpdateTeamCommand';
import { UpdateTeamCommandHandler } from './features/updateteam/UpdateTeamCommandHandler';

const HEAD = atLevel('department_head');
const head = tenantUserReadModel({ id: 'department_head-1', level: 'department_head' });

describe('Org structure handlers', () => {
  const setup = (candidate = head) => {
    const departments = departmentRepository();
    const teams = teamRepository();
    const users = tenantUserQueries(candidate);
    const org = orgStructureQueries();
    const audit = auditLog();
    return {
      departments,
      teams,
      users,
      org,
      audit,
      createDepartment: new CreateDepartmentCommandHandler(
        departments,
        users,
        org,
        audit,
        unitOfWork,
      ),
      updateDepartment: new UpdateDepartmentCommandHandler(
        departments,
        users,
        org,
        audit,
        unitOfWork,
      ),
      deleteDepartment: new DeleteDepartmentCommandHandler(departments, audit, unitOfWork),
      createTeam: new CreateTeamCommandHandler(departments, teams, org, audit, unitOfWork),
      updateTeam: new UpdateTeamCommandHandler(departments, teams, org, audit, unitOfWork),
      deleteTeam: new DeleteTeamCommandHandler(departments, teams, audit, unitOfWork),
      addMember: new AddTeamMemberCommandHandler(departments, teams, users, org, audit, unitOfWork),
      removeMember: new RemoveTeamMemberCommandHandler(departments, teams, org, audit, unitOfWork),
      listDepartments: new GetDepartmentsQueryHandler(org),
      listTeams: new GetTeamsQueryHandler(org),
    };
  };

  describe('departments', () => {
    it('should create with a head and audit it', async () => {
      const { createDepartment, departments, audit } = setup();

      await createDepartment.execute(
        new CreateDepartmentCommand(
          owner,
          { name: 'Finance', headUserId: 'department_head-1' },
          META,
        ),
      );

      expect(departments.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Finance', headUserId: 'department_head-1' }),
        {},
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'department.created' }),
        {},
      );
    });

    it('should let only owners and admins manage departments', async () => {
      const { createDepartment, updateDepartment, deleteDepartment } = setup();

      await expect(
        createDepartment.execute(
          new CreateDepartmentCommand(atLevel('admin'), { name: 'Finance' }, META),
        ),
      ).resolves.toBeDefined();
      for (const caller of [HEAD, atLevel('member')]) {
        await expect(
          createDepartment.execute(new CreateDepartmentCommand(caller, { name: 'Finance' }, META)),
        ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_OPERATION' });
        await expect(
          updateDepartment.execute(
            new UpdateDepartmentCommand(caller, 'dep-1', { name: 'X1' }, META),
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN_OPERATION' });
        await expect(
          deleteDepartment.execute(new DeleteDepartmentCommand(caller, 'dep-1', META)),
        ).rejects.toMatchObject({ code: 'FORBIDDEN_OPERATION' });
      }
    });

    it('should answer 422 on headUserId unless the head is an active department head the caller sees', async () => {
      for (const candidate of [
        tenantUserReadModel({ level: 'member' }),
        tenantUserReadModel({ level: 'department_head', status: 'inactive' }),
        null,
      ]) {
        const { createDepartment, updateDepartment } = setup(candidate as never);
        await expect(
          createDepartment.execute(
            new CreateDepartmentCommand(owner, { name: 'Finance', headUserId: 'u' }, META),
          ),
        ).rejects.toMatchObject({ status: 422, details: [{ field: 'headUserId' }] });
        await expect(
          updateDepartment.execute(
            new UpdateDepartmentCommand(owner, 'dep-1', { headUserId: 'u' }, META),
          ),
        ).rejects.toMatchObject({ status: 422, details: [{ field: 'headUserId' }] });
      }
    });

    it('should answer DEPARTMENT_NAME_CONFLICT, clear the head with null, and 404 unknown ids', async () => {
      const { createDepartment, updateDepartment, departments } = setup();
      departments.activeNameExists.mockResolvedValueOnce(true);
      await expect(
        createDepartment.execute(new CreateDepartmentCommand(owner, { name: 'Finance' }, META)),
      ).rejects.toMatchObject({ status: 409, code: 'DEPARTMENT_NAME_CONFLICT' });

      await updateDepartment.execute(
        new UpdateDepartmentCommand(owner, 'dep-1', { headUserId: null }, META),
      );
      expect(departments.update).toHaveBeenCalledWith(
        expect.objectContaining({ headUserId: null }),
        {},
      );
      expect(departments.activeNameExists).toHaveBeenCalledTimes(1);

      departments.findById.mockResolvedValue(null);
      await expect(
        updateDepartment.execute(new UpdateDepartmentCommand(owner, 'x', {}, META)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should refuse deactivating a department with active teams, else deactivate it', async () => {
      const { deleteDepartment, departments } = setup();
      departments.hasActiveTeams.mockResolvedValueOnce(true);
      await expect(
        deleteDepartment.execute(new DeleteDepartmentCommand(owner, 'dep-1', META)),
      ).rejects.toMatchObject({
        status: 409,
        code: 'DEPARTMENT_HAS_TEAMS',
      });

      expect(
        await deleteDepartment.execute(new DeleteDepartmentCommand(owner, 'dep-1', META)),
      ).toBeNull();
      expect(departments.update).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
        {},
      );
    });
  });

  describe('teams', () => {
    it('should let a head create teams only in departments they head', async () => {
      const { createTeam, departments } = setup();

      await createTeam.execute(
        new CreateTeamCommand(HEAD, { departmentId: 'dep-1', name: 'Payables' }, META),
      );

      departments.findById.mockResolvedValue(department('department_head-2'));
      await expect(
        createTeam.execute(
          new CreateTeamCommand(HEAD, { departmentId: 'dep-1', name: 'Payables' }, META),
        ),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_OPERATION' });
      await expect(
        createTeam.execute(
          new CreateTeamCommand(
            atLevel('admin'),
            { departmentId: 'dep-1', name: 'Payables' },
            META,
          ),
        ),
      ).resolves.toBeDefined();
      await expect(
        createTeam.execute(
          new CreateTeamCommand(
            atLevel('member'),
            { departmentId: 'dep-1', name: 'Payables' },
            META,
          ),
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_OPERATION' });
    });

    it('should answer 422 for an unknown department and TEAM_NAME_CONFLICT on create and rename', async () => {
      const { createTeam, updateTeam, departments, teams } = setup();
      teams.activeNameExists.mockResolvedValue(true);
      await expect(
        createTeam.execute(
          new CreateTeamCommand(owner, { departmentId: 'dep-1', name: 'Payables' }, META),
        ),
      ).rejects.toMatchObject({ status: 409, code: 'TEAM_NAME_CONFLICT' });
      await expect(
        updateTeam.execute(new UpdateTeamCommand(owner, 'team-1', { name: 'Dup' }, META)),
      ).rejects.toMatchObject({ code: 'TEAM_NAME_CONFLICT' });

      departments.findById.mockResolvedValue(null);
      await expect(
        createTeam.execute(
          new CreateTeamCommand(owner, { departmentId: 'x', name: 'Payables' }, META),
        ),
      ).rejects.toMatchObject({ status: 422, details: [{ field: 'departmentId' }] });
    });

    it('should refuse deleting a team with members and 404 an unknown team', async () => {
      const { deleteTeam, teams } = setup();
      teams.hasMembers.mockResolvedValueOnce(true);
      await expect(
        deleteTeam.execute(new DeleteTeamCommand(owner, 'team-1', META)),
      ).rejects.toMatchObject({
        status: 409,
        code: 'TEAM_HAS_MEMBERS',
      });
      expect(await deleteTeam.execute(new DeleteTeamCommand(owner, 'team-1', META))).toBeNull();

      teams.findById.mockResolvedValue(null);
      await expect(
        deleteTeam.execute(new DeleteTeamCommand(owner, 'x', META)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should add and remove members, refusing owners, inactive and unseen users', async () => {
      const { addMember, removeMember, teams, audit } = setup(tenantUserReadModel());
      await addMember.execute(new AddTeamMemberCommand(HEAD, 'team-1', 'user-2', META));
      expect(teams.addMember).toHaveBeenCalledWith('team-1', 'user-2', 'department_head-1', {});
      await removeMember.execute(new RemoveTeamMemberCommand(HEAD, 'team-1', 'user-2', META));
      expect(teams.removeMember).toHaveBeenCalledWith('team-1', 'user-2', {});
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'team.member_removed' }),
        {},
      );

      for (const candidate of [
        tenantUserReadModel({ isOwner: true }),
        tenantUserReadModel({ status: 'inactive' }),
        null,
      ]) {
        await expect(
          setup(candidate as never).addMember.execute(
            new AddTeamMemberCommand(owner, 'team-1', 'u', META),
          ),
        ).rejects.toMatchObject({ status: 422, details: [{ field: 'userId' }] });
      }
    });
  });

  it('should check permission codes first and list with the caller as viewer', async () => {
    const { createDepartment, createTeam, addMember, listDepartments, listTeams, org } = setup();
    const viewer = {
      ...withPermissions('departments.view', 'teams.view'),
      level: 'admin' as const,
    };

    await expect(
      createDepartment.execute(new CreateDepartmentCommand(viewer, { name: 'Finance' }, META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      createTeam.execute(
        new CreateTeamCommand(viewer, { departmentId: 'dep-1', name: 'Ab' }, META),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      addMember.execute(new AddTeamMemberCommand(viewer, 'team-1', 'u', META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(
      (await listDepartments.execute(new GetDepartmentsQuery(viewer, { page: 1, pageSize: 20 })))
        .meta.total,
    ).toBe(1);
    expect(org.findDepartments).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        viewer: { userId: 'staff-1', level: 'admin' },
      }),
    );
    await listTeams.execute(
      new GetTeamsQuery(viewer, { page: 1, pageSize: 20, departmentId: 'dep-1' }),
    );
    expect(org.findTeams).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 'dep-1' }));
  });
});
