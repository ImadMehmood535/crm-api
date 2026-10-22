import { ValidationFailedError } from '@shared/errors/AppError';

import { Branding } from './Branding';
import { detectImageType, parseAssetKind, validateImage } from './BrandingImage';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('Branding', () => {
  it('should apply given colours in lowercase, clear null ones and keep the rest', () => {
    const branding = Branding.rehydrate('org-1', {
      primaryColor: '#111111',
      secondaryColor: '#222222',
      accentColor: null,
    });

    branding.applyColors({ primaryColor: '#0D9488', secondaryColor: null });

    expect(branding.colors).toEqual({
      primaryColor: '#0d9488',
      secondaryColor: null,
      accentColor: null,
    });
  });

  it('should report every bad colour on its own field and change nothing', () => {
    const branding = Branding.empty('org-1');

    const act = (): void =>
      branding.applyColors({ primaryColor: 'teal', secondaryColor: '#12', accentColor: '#abcdef' });

    expect(act).toThrow(ValidationFailedError);
    expect(act).toThrow(
      expect.objectContaining({
        details: [
          { field: 'primaryColor', messages: ['primaryColor must be a hex color like #0d9488.'] },
          {
            field: 'secondaryColor',
            messages: ['secondaryColor must be a hex color like #0d9488.'],
          },
        ],
      }) as Error,
    );
    expect(branding.colors.accentColor).toBeNull();
  });
});

describe('BrandingImage', () => {
  it.each([
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
    [WEBP, 'image/webp'],
    [SVG, null],
  ])('should detect the format from magic bytes', (bytes, type) => {
    expect(detectImageType(bytes)).toBe(type);
  });

  it('should refuse an unknown kind on kind', () => {
    expect(() => parseAssetKind('banner')).toThrow(
      expect.objectContaining({ details: [expect.objectContaining({ field: 'kind' })] }) as Error,
    );
    expect(parseAssetKind('logo')).toBe('logo');
  });

  it('should refuse an empty image on file', () => {
    expect(() => validateImage('logo', Buffer.alloc(0))).toThrow(
      expect.objectContaining({
        status: 422,
        details: [expect.objectContaining({ field: 'file' })],
      }) as Error,
    );
  });

  it('should accept exactly the kind limit and answer 413 above it', () => {
    const atLimit = Buffer.concat([PNG, Buffer.alloc(128 * 1024 - PNG.length)]);

    expect(validateImage('favicon', atLimit)).toBe('image/png');
    expect(() => validateImage('favicon', Buffer.concat([atLimit, Buffer.alloc(1)]))).toThrow(
      expect.objectContaining({
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The image is too large (limit 128 KB).',
      }) as Error,
    );
  });

  it('should answer 415 for SVG', () => {
    expect(() => validateImage('logo', SVG)).toThrow(
      expect.objectContaining({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' }) as Error,
    );
  });
});
