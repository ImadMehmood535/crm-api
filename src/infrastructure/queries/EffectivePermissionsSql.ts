/**
 * Effective `module.action` codes of the user identified by `userExpr` (a column such as `u.id` or
 * the replacement `:userId`; always a constant, never input):
 * - holder of the company's active system role (the owner) → the whole catalogue, including codes
 *   added later;
 * - everyone else → the union of the grants of their active roles.
 * Platform users hold neither, so they get none. UNION also removes duplicates.
 */
export function effectivePermissionsSql(userExpr: string): string {
  return `
    SELECT p.code FROM permissions p
    WHERE EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userExpr} AND r.is_active AND r.is_system_role AND r.organization_id IS NOT NULL)
    UNION
    SELECT p.code FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.is_active
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ${userExpr}`;
}
