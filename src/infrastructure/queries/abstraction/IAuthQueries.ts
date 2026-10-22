export const AUTH_QUERIES = Symbol('AUTH_QUERIES');

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/** The frontend's `AuthUser`, exactly. */
export interface AuthUserReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plane: 'platform' | 'tenant';
  roles: string[];
  isSuperUser: boolean;
  organization: OrganizationRef | null;
  mustResetPassword: boolean;
  permissions: string[];
}

/** What the access policy needs next to the AuthUser. */
export interface AccountReadModel {
  user: AuthUserReadModel;
  userStatus: string;
  organizationStatus: string | null;
}

export interface IAuthQueries {
  findAccount(userId: string): Promise<AccountReadModel | null>;
}
