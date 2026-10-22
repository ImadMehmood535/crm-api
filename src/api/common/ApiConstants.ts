/** Route prefixes (under /api/v1) and Swagger tags, in one place. */
export const ApiRoute = {
  Auth: 'auth',
  PlatformDevelopers: 'platform/developers',
  PlatformInvites: 'platform/invites',
  PublicInvites: 'public/invites',
  PlatformAdmins: 'platform/admins',
  Platform: 'platform',
} as const;

export const SwaggerTag = {
  Auth: 'Auth',
  PlatformDevelopers: 'Platform · Developers',
  PlatformInvites: 'Platform · Invites',
  PublicInvites: 'Public · Invites',
  PlatformAdmins: 'Platform · Admins',
  PlatformInsights: 'Platform · Stats & audit',
} as const;
