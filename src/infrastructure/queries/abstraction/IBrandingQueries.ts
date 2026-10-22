export const BRANDING_QUERIES = Symbol('BRANDING_QUERIES');

/** The frontend's `BrandingResponse`. URLs are same-origin and immutable. */
export interface BrandingReadModel {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  backgroundImageUrl: string | null;
}

export interface BrandingAssetFile {
  contentType: string;
  data: Buffer;
}

export interface IBrandingQueries {
  /** null while the company has configured nothing at all. */
  findBranding(organizationId: string): Promise<BrandingReadModel | null>;
  findAsset(id: string): Promise<BrandingAssetFile | null>;
}
