import {
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationFailedError,
} from '@shared/errors/AppError';

export const ASSET_KINDS = ['logo', 'favicon', 'background'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';

const KB = 1024;
export const ASSET_SIZE_LIMITS: Record<AssetKind, number> = {
  logo: 512 * KB,
  favicon: 128 * KB,
  background: 2048 * KB,
};

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The real format from the bytes themselves (the declared Content-Type is not trusted). */
export function detectImageType(bytes: Buffer): ImageType | null {
  if (bytes.length >= PNG.length && PNG.every((value, i) => bytes[i] === value)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function parseAssetKind(value: string): AssetKind {
  if (!(ASSET_KINDS as readonly string[]).includes(value)) {
    throw ValidationFailedError.forField('kind', 'kind must be logo, favicon or background.');
  }
  return value as AssetKind;
}

/** Empty → 422 `file`; over the kind's limit → 413; not PNG/JPEG/WebP → 415. */
export function validateImage(kind: AssetKind, bytes: Buffer): ImageType {
  if (bytes.length === 0) throw ValidationFailedError.forField('file', 'The image is empty.');
  const limit = ASSET_SIZE_LIMITS[kind];
  if (bytes.length > limit) {
    throw new PayloadTooLargeError(`The image is too large (limit ${limit / KB} KB).`);
  }
  const type = detectImageType(bytes);
  if (!type) {
    throw new UnsupportedMediaTypeError(
      'Upload a PNG, JPEG or WebP image (SVG and other formats are not accepted).',
    );
  }
  return type;
}
