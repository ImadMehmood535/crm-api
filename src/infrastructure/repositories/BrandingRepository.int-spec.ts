import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { uuidv7 } from '../../shared/utils/Uuid';
import { BrandingPersistenceModule } from '../persistence/BrandingPersistenceModule';
import { BRANDING_QUERIES, IBrandingQueries } from '../queries/abstraction/IBrandingQueries';
import { BRANDING_REPOSITORY, IBrandingRepository } from './abstraction/IBrandingRepository';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);

describe('BrandingRepository / BrandingQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let repository: IBrandingRepository;
  let queries: IBrandingQueries;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([BrandingPersistenceModule]));
    repository = moduleRef.get(BRANDING_REPOSITORY);
    queries = moduleRef.get(BRANDING_QUERIES);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    orgId = await createOrganization(sequelize);
    userId = await createUser(sequelize, { email: 'o@example.com', organizationId: orgId });
  });
  afterAll(() => moduleRef.close());

  it('should report nothing configured, then upsert colours', async () => {
    expect(await queries.findBranding(orgId)).toBeNull();
    const branding = await repository.findColors(orgId);
    branding.applyColors({ primaryColor: '#0d9488' });

    await repository.saveColors(branding, userId);
    branding.applyColors({ accentColor: '#f97316' });
    await repository.saveColors(branding, userId);

    expect(await queries.findBranding(orgId)).toEqual({
      primaryColor: '#0d9488',
      secondaryColor: null,
      accentColor: '#f97316',
      logoUrl: null,
      faviconUrl: null,
      backgroundImageUrl: null,
    });
  });

  it('should give a replaced image a new id and serve its bytes, and remove it', async () => {
    const first = await repository.replaceAsset(orgId, 'logo', 'image/png', PNG);
    const second = await repository.replaceAsset(orgId, 'logo', 'image/png', PNG);

    expect(second).not.toBe(first);
    expect(await queries.findAsset(first)).toBeNull();
    expect(await queries.findAsset(second)).toEqual({ contentType: 'image/png', data: PNG });
    expect((await queries.findBranding(orgId))?.logoUrl).toBe(`/api/v1/branding-assets/${second}`);

    await repository.removeAsset(orgId, 'logo');
    expect(await queries.findBranding(orgId)).toBeNull();
    expect(await queries.findAsset(uuidv7())).toBeNull();
  });

  it("should keep each company's branding separate", async () => {
    const other = await createOrganization(sequelize);
    await repository.replaceAsset(other, 'favicon', 'image/png', PNG);

    expect(await queries.findBranding(orgId)).toBeNull();
    expect((await queries.findBranding(other))?.faviconUrl).toMatch(
      /^\/api\/v1\/branding-assets\//,
    );
  });
});
