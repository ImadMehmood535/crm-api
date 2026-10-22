import { NotFoundError } from '@shared/errors/AppError';
import {
  BrandingReadModel,
  IBrandingQueries,
} from '@infrastructure/queries/abstraction/IBrandingQueries';

import { BrandingResponse } from './features/getbranding/BrandingResponse';

const NOTHING: BrandingReadModel = {
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  logoUrl: null,
  faviconUrl: null,
  backgroundImageUrl: null,
};

export const brandingNotConfigured = (): NotFoundError =>
  new NotFoundError('No branding configured.');

/** After a write: the full branding, all-null once everything was cleared. */
export async function currentBranding(
  queries: IBrandingQueries,
  organizationId: string,
): Promise<BrandingResponse> {
  return BrandingResponse.from((await queries.findBranding(organizationId)) ?? NOTHING);
}
