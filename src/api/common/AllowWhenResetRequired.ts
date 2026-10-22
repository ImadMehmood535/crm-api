import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_RESET_REQUIRED = 'allowWhenResetRequired';

/** Reachable by a user who still has a temporary password (me, logout, reset-password). */
export const AllowWhenResetRequired = (): MethodDecorator =>
  SetMetadata(ALLOW_WHEN_RESET_REQUIRED, true);
