import { ForbiddenError } from '@shared/errors/AppError';

/**
 * Who may authenticate — at login, at refresh and on every request. The company is checked first,
 * so a suspended company's users see the "company suspended" screen whatever their own status.
 */
export function assertCanAuthenticate(userStatus: string, organizationStatus: string | null): void {
  if (organizationStatus !== null && organizationStatus !== 'active') {
    throw new ForbiddenError(
      'ORGANIZATION_SUSPENDED',
      'This company account is suspended. Please contact Invespy.',
    );
  }
  if (userStatus !== 'active') {
    throw new ForbiddenError('ACCOUNT_INACTIVE', 'This account is not active.');
  }
}
