import { Request } from 'express';

import { Actor } from '@shared/auth/Actor';

export interface AuthenticatedRequest extends Request {
  actor?: Actor;
}
