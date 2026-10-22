/** Hierarchy levels of tenant users, highest first. */
export const USER_LEVELS = ['owner', 'admin', 'department_head', 'member'] as const;
export type UserLevel = (typeof USER_LEVELS)[number];
/** Levels a user can be given; `owner` is never assigned through the API. */
export const CREATABLE_LEVELS = ['admin', 'department_head', 'member'] as const;
