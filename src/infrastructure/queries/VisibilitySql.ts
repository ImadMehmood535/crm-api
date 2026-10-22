/**
 * Hierarchy SQL fragments. Arguments are always constant aliases written in code, never input.
 *
 * Effective level: the holder of the company's active system role is `owner` (ownership is defined
 * by that role alone); other tenant users use their stored level (member by default); platform
 * users have none.
 */
export function effectiveLevelSql(alias: string): string {
  return `CASE
    WHEN EXISTS (SELECT 1 FROM user_roles lr JOIN roles lrr ON lrr.id = lr.role_id
                 WHERE lr.user_id = ${alias}.id AND lrr.is_system_role AND lrr.is_active
                   AND lrr.organization_id IS NOT NULL) THEN 'owner'
    WHEN ${alias}.organization_id IS NULL THEN NULL
    ELSE coalesce(${alias}.level, 'member')
  END`;
}

/**
 * Users the viewer may see, as CTE `visible(id)`. Replacements: :organizationId, :viewerId,
 * :viewerLevel.
 * - owner: everyone in the company;
 * - admin: owners, admins and everyone created (transitively) by an admin;
 * - department head: themselves, people they created (transitively) and the members of the teams
 *   of the departments they head;
 * - member: themselves and the members of their teams.
 */
export const VISIBLE_USERS_CTE = `
  RECURSIVE company AS (
    SELECT u.id, u.created_by, ${effectiveLevelSql('u')} AS level
    FROM users u WHERE u.organization_id = :organizationId
  ),
  admin_tree AS (
    SELECT id FROM company WHERE level = 'admin'
    UNION
    SELECT c.id FROM company c JOIN admin_tree t ON c.created_by = t.id
  ),
  own_tree AS (
    SELECT CAST(:viewerId AS uuid) AS id
    UNION
    SELECT c.id FROM company c JOIN own_tree t ON c.created_by = t.id
  ),
  head_members AS (
    SELECT tm.user_id AS id FROM team_members tm
    JOIN teams t ON t.id = tm.team_id AND t.is_active
    JOIN departments d ON d.id = t.department_id AND d.is_active
    WHERE d.head_user_id = :viewerId
  ),
  teammates AS (
    SELECT tm.user_id AS id FROM team_members tm
    JOIN teams t ON t.id = tm.team_id AND t.is_active
    WHERE tm.team_id IN (SELECT team_id FROM team_members WHERE user_id = :viewerId)
  ),
  visible AS (
    SELECT id FROM company WHERE :viewerLevel = 'owner'
    UNION SELECT id FROM company WHERE :viewerLevel = 'admin' AND level IN ('owner', 'admin')
    UNION SELECT id FROM admin_tree WHERE :viewerLevel = 'admin'
    UNION SELECT id FROM own_tree WHERE :viewerLevel = 'department_head'
    UNION SELECT id FROM head_members WHERE :viewerLevel = 'department_head'
    UNION SELECT CAST(:viewerId AS uuid) WHERE :viewerLevel = 'member'
    UNION SELECT id FROM teammates WHERE :viewerLevel = 'member'
  )`;
