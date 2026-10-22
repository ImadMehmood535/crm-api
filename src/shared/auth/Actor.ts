import { UserLevel } from './UserLevel';

export type Plane = 'platform' | 'tenant';

/** The authenticated caller, resolved from the access token and the database on every request. */
export interface Actor {
  readonly userId: string;
  /** The login chain (session family) the access token belongs to. */
  readonly sessionId: string;
  /** null on the platform plane. */
  readonly organizationId: string | null;
  readonly plane: Plane;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly isSuperUser: boolean;
  readonly mustResetPassword: boolean;
  /** Hierarchy level (owner | admin | department_head | member); null on the platform plane. */
  readonly level: UserLevel | null;
}

/** Where a request came from; recorded on sessions, never used for decisions. */
export interface RequestMeta {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}
