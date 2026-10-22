import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { offsetOf } from '@shared/utils/Pagination';

import {
  DepartmentListFilter,
  DepartmentReadModel,
  IOrgStructureQueries,
  PersonReadModel,
  TeamListFilter,
  TeamReadModel,
} from './abstraction/IOrgStructureQueries';
import { Viewer } from './abstraction/ITenantUserQueries';

const PERSON = (alias: string): string =>
  `json_build_object('id', ${alias}.id, 'firstName', ${alias}.first_name, 'lastName', ${alias}.last_name, 'email', ${alias}.email)`;

const DEPARTMENT_SELECT = `
  SELECT d.id, d.name, d.created_at,
         CASE WHEN h.id IS NULL THEN NULL ELSE ${PERSON('h')} END AS head,
         (SELECT count(*)::int FROM teams t WHERE t.department_id = d.id AND t.is_active) AS team_count,
         (SELECT count(DISTINCT tm.user_id)::int FROM team_members tm JOIN teams t ON t.id = tm.team_id
           WHERE t.department_id = d.id AND t.is_active) AS member_count
  FROM departments d LEFT JOIN users h ON h.id = d.head_user_id`;

// Owners and admins see everything; others see what they head or belong to.
const DEPARTMENT_WHERE = `
  WHERE d.organization_id = :organizationId AND d.is_active
    AND (:seesAll OR d.head_user_id = :viewerId
         OR d.id IN (SELECT t.department_id FROM teams t JOIN team_members tm ON tm.team_id = t.id
                      WHERE tm.user_id = :viewerId AND t.is_active))`;

const DEPARTMENTS_SQL = `${DEPARTMENT_SELECT} ${DEPARTMENT_WHERE} ORDER BY d.name_key, d.id LIMIT :limit OFFSET :offset`;
const DEPARTMENTS_COUNT_SQL = `SELECT count(*)::int AS total FROM departments d ${DEPARTMENT_WHERE}`;
const DEPARTMENT_SQL = `${DEPARTMENT_SELECT} WHERE d.organization_id = :organizationId AND d.id = :id AND d.is_active`;

const TEAM_SELECT = `
  SELECT t.id, t.name, t.created_at, json_build_object('id', d.id, 'name', d.name) AS department,
         (SELECT coalesce(json_agg(${PERSON('u')} ORDER BY u.first_name, u.last_name, u.id), '[]')
            FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = t.id) AS members
  FROM teams t JOIN departments d ON d.id = t.department_id`;

const TEAM_WHERE = `
  WHERE t.organization_id = :organizationId AND t.is_active AND d.is_active
    AND (CAST(:departmentId AS uuid) IS NULL OR t.department_id = CAST(:departmentId AS uuid))
    AND (:seesAll OR d.head_user_id = :viewerId
         OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = :viewerId))`;

const TEAMS_SQL = `${TEAM_SELECT} ${TEAM_WHERE} ORDER BY t.name_key, t.id LIMIT :limit OFFSET :offset`;
const TEAMS_COUNT_SQL = `SELECT count(*)::int AS total FROM teams t JOIN departments d ON d.id = t.department_id ${TEAM_WHERE}`;
const TEAM_SQL = `${TEAM_SELECT} WHERE t.organization_id = :organizationId AND t.id = :id AND t.is_active`;

const seesAll = (viewer: Viewer): boolean => viewer.level === 'owner' || viewer.level === 'admin';

interface DepartmentRow {
  id: string;
  name: string;
  head: PersonReadModel | null;
  team_count: number;
  member_count: number;
  created_at: Date;
}

interface TeamRow {
  id: string;
  name: string;
  department: { id: string; name: string };
  members: PersonReadModel[];
  created_at: Date;
}

@Injectable()
export class OrgStructureQueries implements IOrgStructureQueries {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findDepartments(
    filter: DepartmentListFilter,
  ): Promise<{ rows: DepartmentReadModel[]; total: number }> {
    const replacements = {
      organizationId: filter.organizationId,
      seesAll: seesAll(filter.viewer),
      viewerId: filter.viewer.userId,
      limit: filter.pageSize,
      offset: offsetOf(filter),
    };
    const rows = await this.sequelize.query<DepartmentRow>(DEPARTMENTS_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(DEPARTMENTS_COUNT_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toDepartment), total };
  }

  async findDepartment(organizationId: string, id: string): Promise<DepartmentReadModel | null> {
    const rows = await this.sequelize.query<DepartmentRow>(DEPARTMENT_SQL, {
      replacements: { organizationId, id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toDepartment(rows[0]) : null;
  }

  async findTeams(filter: TeamListFilter): Promise<{ rows: TeamReadModel[]; total: number }> {
    const replacements = {
      organizationId: filter.organizationId,
      departmentId: filter.departmentId ?? null,
      seesAll: seesAll(filter.viewer),
      viewerId: filter.viewer.userId,
      limit: filter.pageSize,
      offset: offsetOf(filter),
    };
    const rows = await this.sequelize.query<TeamRow>(TEAMS_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const [{ total }] = await this.sequelize.query<{ total: number }>(TEAMS_COUNT_SQL, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return { rows: rows.map(toTeam), total };
  }

  async findTeam(organizationId: string, id: string): Promise<TeamReadModel | null> {
    const rows = await this.sequelize.query<TeamRow>(TEAM_SQL, {
      replacements: { organizationId, id },
      type: QueryTypes.SELECT,
    });
    return rows.length ? toTeam(rows[0]) : null;
  }
}

function toDepartment(row: DepartmentRow): DepartmentReadModel {
  return {
    id: row.id,
    name: row.name,
    head: row.head,
    teamCount: row.team_count,
    memberCount: row.member_count,
    createdAt: row.created_at.toISOString(),
  };
}

function toTeam(row: TeamRow): TeamReadModel {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    members: row.members,
    createdAt: row.created_at.toISOString(),
  };
}
