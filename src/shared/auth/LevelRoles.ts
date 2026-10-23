/** Levels that get a locked built-in role instead of hand-picked roles. */
export const ROLE_LEVELS = ['admin', 'department_head'] as const;
export type RoleLevel = (typeof ROLE_LEVELS)[number];

export const isRoleLevel = (level: string): level is RoleLevel =>
  (ROLE_LEVELS as readonly string[]).includes(level);

export const LEVEL_ROLE: Record<RoleLevel, { code: string; name: string; description: string }> = {
  admin: {
    code: 'level_admin',
    name: 'Admin',
    description: 'Built-in: every permission, like the owner (but cannot manage the owner).',
  },
  department_head: {
    code: 'level_department_head',
    name: 'Department Head',
    description: "Built-in: manages their departments' teams and people.",
  },
};

/** What a department head can do. Admins (like owners) hold the whole catalogue. */
export const DEPARTMENT_HEAD_PERMISSIONS = [
  'departments.view',
  'projects.view',
  'roles.view',
  'teams.create',
  'teams.delete',
  'teams.edit',
  'teams.view',
  'units.view',
  'users.create',
  'users.deactivate',
  'users.edit',
  'users.view',
] as const;
