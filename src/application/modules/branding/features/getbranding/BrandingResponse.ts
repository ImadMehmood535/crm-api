import { ApiProperty } from '@nestjs/swagger';

import { BrandingReadModel } from '@infrastructure/queries/abstraction/IBrandingQueries';

/** The frontend's `BrandingResponse`: null colours mean "use the Invespy default". */
export class BrandingResponse {
  @ApiProperty({ nullable: true, type: String, example: '#0d9488' }) primaryColor!: string | null;
  @ApiProperty({ nullable: true, type: String }) secondaryColor!: string | null;
  @ApiProperty({ nullable: true, type: String }) accentColor!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '/api/v1/branding-assets/0192…' })
  logoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) faviconUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) backgroundImageUrl!: string | null;

  static from(branding: BrandingReadModel): BrandingResponse {
    return Object.assign(new BrandingResponse(), branding);
  }
}
