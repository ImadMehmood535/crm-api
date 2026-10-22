import { META } from '../../../../../../test/support/auth-mocks';
import { auditLog, platformAdmin, unitOfWork } from '../../../../../../test/support/platform-mocks';
import { owner, withPermissions } from '../../../../../../test/support/tenant-mocks';
import { Branding } from '@domain/aggregates/BrandingAggregate/Branding';
import { IBrandingQueries } from '@infrastructure/queries/abstraction/IBrandingQueries';
import { IBrandingRepository } from '@infrastructure/repositories/abstraction/IBrandingRepository';

import { GetBrandingQuery } from '../getbranding/GetBrandingQuery';
import { GetBrandingQueryHandler } from '../getbranding/GetBrandingQueryHandler';
import { GetBrandingAssetQuery } from '../getbrandingasset/GetBrandingAssetQuery';
import { GetBrandingAssetQueryHandler } from '../getbrandingasset/GetBrandingAssetQueryHandler';
import { RemoveBrandingAssetCommand } from '../removebrandingasset/RemoveBrandingAssetCommand';
import { RemoveBrandingAssetCommandHandler } from '../removebrandingasset/RemoveBrandingAssetCommandHandler';
import { UploadBrandingAssetCommand } from '../uploadbrandingasset/UploadBrandingAssetCommand';
import { UploadBrandingAssetCommandHandler } from '../uploadbrandingasset/UploadBrandingAssetCommandHandler';
import { UpdateBrandingCommand } from './UpdateBrandingCommand';
import { UpdateBrandingCommandHandler } from './UpdateBrandingCommandHandler';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

describe('Branding handlers', () => {
  const setup = (configured: boolean) => {
    const repository: jest.Mocked<IBrandingRepository> = {
      findColors: jest.fn().mockResolvedValue(Branding.empty('org-1')),
      saveColors: jest.fn(),
      replaceAsset: jest.fn().mockResolvedValue('asset-1'),
      removeAsset: jest.fn(),
    };
    const queries: jest.Mocked<IBrandingQueries> = {
      findBranding: jest.fn().mockResolvedValue(
        configured
          ? {
              primaryColor: '#0d9488',
              secondaryColor: null,
              accentColor: null,
              logoUrl: null,
              faviconUrl: null,
              backgroundImageUrl: null,
            }
          : null,
      ),
      findAsset: jest.fn().mockResolvedValue(null),
    };
    const audit = auditLog();
    return {
      repository,
      queries,
      audit,
      get: new GetBrandingQueryHandler(queries),
      update: new UpdateBrandingCommandHandler(repository, queries, audit, unitOfWork),
      upload: new UploadBrandingAssetCommandHandler(repository, queries, audit, unitOfWork),
      remove: new RemoveBrandingAssetCommandHandler(repository, queries, audit, unitOfWork),
      asset: new GetBrandingAssetQueryHandler(queries),
    };
  };

  it('should read branding for any tenant user and answer NOT_FOUND when unconfigured', async () => {
    expect(
      (await setup(true).get.execute(new GetBrandingQuery(withPermissions()))).primaryColor,
    ).toBe('#0d9488');
    await expect(setup(false).get.execute(new GetBrandingQuery(owner))).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      setup(true).get.execute(new GetBrandingQuery(platformAdmin)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('should save colours with an audit entry and answer all-null after clearing everything', async () => {
    const { update, repository, audit } = setup(false);

    const result = await update.execute(
      new UpdateBrandingCommand(owner, { primaryColor: '#ABCDEF' }, META),
    );

    expect(repository.saveColors).toHaveBeenCalledWith(
      expect.objectContaining({ colors: expect.objectContaining({ primaryColor: '#abcdef' }) }),
      owner.userId,
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'branding.updated' }),
      {},
    );
    expect(result.primaryColor).toBeNull();
  });

  it('should require branding.edit for changes', async () => {
    const readOnly = withPermissions('branding.view');
    const { update, upload, remove } = setup(true);

    await expect(
      update.execute(new UpdateBrandingCommand(readOnly, {}, META)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      upload.execute(new UploadBrandingAssetCommand(readOnly, 'logo', PNG, META)),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(
      remove.execute(new RemoveBrandingAssetCommand(readOnly, 'logo', META)),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('should store an uploaded image under its detected type and refuse bad input before storing', async () => {
    const { upload, repository } = setup(true);

    await upload.execute(new UploadBrandingAssetCommand(owner, 'logo', PNG, META));

    expect(repository.replaceAsset).toHaveBeenCalledWith('org-1', 'logo', 'image/png', PNG, {});
    await expect(
      upload.execute(new UploadBrandingAssetCommand(owner, 'banner', PNG, META)),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      upload.execute(new UploadBrandingAssetCommand(owner, 'logo', Buffer.from('x'), META)),
    ).rejects.toMatchObject({
      status: 415,
    });
    expect(repository.replaceAsset).toHaveBeenCalledTimes(1);
  });

  it('should remove an image and answer NOT_FOUND for an unknown asset', async () => {
    const { remove, repository, asset } = setup(true);

    await remove.execute(new RemoveBrandingAssetCommand(owner, 'favicon', META));

    expect(repository.removeAsset).toHaveBeenCalledWith('org-1', 'favicon', {});
    await expect(asset.execute(new GetBrandingAssetQuery('x'))).rejects.toMatchObject({
      status: 404,
    });
  });
});
