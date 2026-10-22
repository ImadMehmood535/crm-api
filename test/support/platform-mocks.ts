import { Invite } from '../../src/domain/aggregates/InviteAggregate/Invite';
import { Organization } from '../../src/domain/aggregates/OrganizationAggregate/Organization';
import { IAuditLog } from '../../src/infrastructure/audit/abstraction/IAuditLog';
import { IMailer } from '../../src/infrastructure/mail/abstraction/IMailer';
import { IUnitOfWork } from '../../src/infrastructure/persistence/abstraction/IUnitOfWork';
import {
  DeveloperReadModel,
  IDeveloperQueries,
} from '../../src/infrastructure/queries/abstraction/IDeveloperQueries';
import {
  IInviteQueries,
  InviteReadModel,
} from '../../src/infrastructure/queries/abstraction/IInviteQueries';
import {
  IPlatformAdminQueries,
  PlatformAdminReadModel,
} from '../../src/infrastructure/queries/abstraction/IPlatformAdminQueries';
import { IInviteRepository } from '../../src/infrastructure/repositories/abstraction/IInviteRepository';
import { IOrganizationRepository } from '../../src/infrastructure/repositories/abstraction/IOrganizationRepository';
import { IRoleRepository } from '../../src/infrastructure/repositories/abstraction/IRoleRepository';
import { actor } from './auth-mocks';

export const platformSuper = actor({
  plane: 'platform',
  organizationId: null,
  roles: ['platform_super_user'],
});
export const platformAdmin = actor({
  plane: 'platform',
  organizationId: null,
  roles: ['platform_admin'],
});
export const tenantUser = actor();

export const unitOfWork: IUnitOfWork = { run: (work) => work({}) };

export const developer = (overrides: Partial<DeveloperReadModel> = {}): DeveloperReadModel => ({
  id: 'org-1',
  name: 'Palm Estates',
  slug: 'palm-estates',
  status: 'active',
  createdAt: '2026-10-23T00:00:00.000Z',
  userCount: 1,
  superUser: { id: 'owner-1', email: 'owner@palm.example.com', name: 'Sara Khan' },
  ...overrides,
});

export const inviteReadModel = (overrides: Partial<InviteReadModel> = {}): InviteReadModel => ({
  id: 'inv-1',
  email: 'founder@harbor.example.com',
  firstName: 'Ali',
  lastName: 'Raza',
  organizationName: 'Harbor Homes',
  slug: 'harbor-homes',
  status: 'pending',
  expiresAt: '2026-10-30T00:00:00.000Z',
  createdAt: '2026-10-23T00:00:00.000Z',
  ...overrides,
});

export const adminReadModel = (
  overrides: Partial<PlatformAdminReadModel> = {},
): PlatformAdminReadModel => ({
  id: 'admin-1',
  email: 'ana@invespy.example.com',
  firstName: 'Ana',
  lastName: 'Lee',
  role: 'platform_admin',
  isActive: true,
  createdAt: '2026-10-23T00:00:00.000Z',
  ...overrides,
});

export function pendingInvite(): Invite {
  return Invite.rehydrate(
    'inv-1',
    'founder@harbor.example.com',
    'Ali',
    'Raza',
    'Harbor Homes',
    'harbor-homes',
    'h'.repeat(64),
    'pending',
    new Date(Date.now() + 86_400_000),
    'op-1',
    null,
  );
}

export function organizationRepository(): jest.Mocked<IOrganizationRepository> {
  return {
    save: jest
      .fn()
      .mockImplementation((o: Organization) =>
        Promise.resolve(Organization.rehydrate('org-1', o.name, o.slug, o.status, o.createdBy)),
      ),
    update: jest.fn(),
    findById: jest.fn(),
    slugExists: jest.fn().mockResolvedValue(false),
  };
}

export function roleRepository(): jest.Mocked<IRoleRepository> {
  return {
    createOwnerRole: jest.fn().mockResolvedValue('role-1'),
    findPlatformRoleId: jest.fn().mockResolvedValue('role-admin'),
  };
}

export function inviteRepository(): jest.Mocked<IInviteRepository> {
  return {
    save: jest.fn().mockImplementation((i: Invite) => Promise.resolve(i)),
    update: jest.fn(),
    findById: jest.fn(),
    findByTokenHash: jest.fn(),
    livePendingEmailExists: jest.fn().mockResolvedValue(false),
    livePendingSlugExists: jest.fn().mockResolvedValue(false),
  };
}

export function developerQueries(
  found: DeveloperReadModel | null = developer(),
): jest.Mocked<IDeveloperQueries> {
  return {
    findList: jest.fn().mockResolvedValue({ rows: [developer()], total: 1 }),
    findById: jest.fn().mockResolvedValue(found),
  };
}

export function inviteQueries(
  found: InviteReadModel | null = inviteReadModel(),
): jest.Mocked<IInviteQueries> {
  return {
    findList: jest.fn().mockResolvedValue({ rows: [inviteReadModel()], total: 1 }),
    findById: jest.fn().mockResolvedValue(found),
    findLivePreview: jest.fn(),
  };
}

export function adminQueries(
  found: PlatformAdminReadModel | null = adminReadModel(),
): jest.Mocked<IPlatformAdminQueries> {
  return {
    findList: jest.fn().mockResolvedValue({ rows: [found], total: 1 }),
    findById: jest.fn().mockResolvedValue(found),
  };
}

export const auditLog = (): jest.Mocked<IAuditLog> => ({ record: jest.fn() });
export const mailer = (): jest.Mocked<IMailer> => ({ send: jest.fn() });
