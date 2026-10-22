import { Role } from '../../src/domain/aggregates/RoleAggregate/Role';
import {
  IRbacQueries,
  RoleReadModel,
} from '../../src/infrastructure/queries/abstraction/IRbacQueries';
import {
  ITenantUserQueries,
  TenantUserReadModel,
} from '../../src/infrastructure/queries/abstraction/ITenantUserQueries';
import { actor } from './auth-mocks';

export const ALL_CODES = [
  'users.view',
  'users.create',
  'users.edit',
  'users.deactivate',
  'roles.view',
  'roles.create',
  'roles.edit',
  'roles.delete',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'units.view',
  'units.create',
  'units.edit',
  'units.delete',
  'branding.view',
  'branding.edit',
];

export const owner = actor({ permissions: ALL_CODES });
export const withPermissions = (...codes: string[]) =>
  actor({ userId: 'staff-1', permissions: codes, roles: ['staff'], isSuperUser: false });

export const customRole = (permissions: string[] = ['users.view'], id = 'role-1'): Role =>
  Role.rehydrate(id, 'org-1', 'Sales', 'sales', null, permissions, false, true);
export const systemRole = (): Role =>
  Role.rehydrate(
    'role-owner',
    'org-1',
    'Developer Super User',
    'developer_super_user',
    null,
    [],
    true,
    true,
  );

export const roleReadModel = (overrides: Partial<RoleReadModel> = {}): RoleReadModel => ({
  id: 'role-1',
  name: 'Sales',
  code: 'sales',
  description: null,
  isSystem: false,
  permissions: ['users.view'],
  userCount: 0,
  createdAt: '2026-10-23T00:00:00.000Z',
  ...overrides,
});

export const tenantUserReadModel = (
  overrides: Partial<TenantUserReadModel> = {},
): TenantUserReadModel => ({
  id: 'user-2',
  email: 'hira@skyline.example.com',
  firstName: 'Hira',
  lastName: 'Shah',
  status: 'active',
  isOwner: false,
  roles: [{ id: 'role-1', name: 'Sales', code: 'sales' }],
  permissions: ['users.view'],
  lastLoginAt: null,
  createdAt: '2026-10-23T00:00:00.000Z',
  ...overrides,
});

export function rbacQueries(): jest.Mocked<IRbacQueries> {
  return {
    catalogue: jest.fn().mockResolvedValue([]),
    allCodes: jest.fn().mockResolvedValue(ALL_CODES),
    findRoles: jest.fn().mockResolvedValue({ rows: [roleReadModel()], total: 1 }),
    findRole: jest.fn().mockResolvedValue(roleReadModel()),
  };
}

export function tenantUserQueries(
  found: TenantUserReadModel | null = tenantUserReadModel(),
): jest.Mocked<ITenantUserQueries> {
  return {
    findList: jest.fn().mockResolvedValue({ rows: [tenantUserReadModel()], total: 1 }),
    findById: jest.fn().mockResolvedValue(found),
  };
}
