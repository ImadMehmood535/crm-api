import { DEPARTMENT_HEAD_PERMISSIONS } from '@shared/auth/LevelRoles';

/** The head set as an SQL list literal. Built from a code constant, never from input. */
export const HEAD_CODES_SQL = DEPARTMENT_HEAD_PERMISSIONS.map((code) => `'${code}'`).join(', ');

/**
 * Codes the user's roles give (`userExpr` is a column such as `u.id` or the replacement `:userId`;
 * always a constant, never input):
 * - holder of the company's owner role or the built-in "Admin" level role → the whole catalogue,
 *   including codes added later;
 * - holder of the built-in "Department Head" level role → the department head set;
 * - plus the union of the grants of their other active roles.
 * Platform users hold none of these, so they get none. UNION also removes duplicates.
 */
export function rolePermissionsSql(userExpr: string): string {
  return `
    SELECT p.code FROM permissions p
    WHERE EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userExpr} AND r.is_active AND r.organization_id IS NOT NULL
        AND (r.is_system_role OR r.level_role = 'admin'))
    UNION
    SELECT p.code FROM permissions p
    WHERE p.code IN (${HEAD_CODES_SQL}) AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userExpr} AND r.is_active AND r.level_role = 'department_head')
    UNION
    SELECT p.code FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.is_active
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ${userExpr}`;
}

/** The user's overrides with one effect (`grant` | `revoke`), as a code list. */
export function overrideCodesSql(userExpr: string, effect: 'grant' | 'revoke'): string {
  return `
    SELECT p.code FROM user_permission_overrides o JOIN permissions p ON p.id = o.permission_id
    WHERE o.user_id = ${userExpr} AND o.effect = '${effect}'`;
}

/** Effective codes: (role codes ∪ granted overrides) − revoked overrides. */
export function effectivePermissionsSql(userExpr: string): string {
  return `
    (${rolePermissionsSql(userExpr)}
     UNION ${overrideCodesSql(userExpr, 'grant')})
    EXCEPT ${overrideCodesSql(userExpr, 'revoke')}`;
}
