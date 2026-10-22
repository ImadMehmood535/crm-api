import { Actor } from '@shared/auth/Actor';
import { UserLevel } from '@shared/auth/UserLevel';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from '@shared/errors/AppError';
import { Department } from '@domain/aggregates/DepartmentAggregate/Department';
import { Team } from '@domain/aggregates/TeamAggregate/Team';
import { TenantUserReadModel } from '@infrastructure/queries/abstraction/ITenantUserQueries';
import { IDepartmentRepository } from '@infrastructure/repositories/abstraction/IDepartmentRepository';
import { ITeamRepository } from '@infrastructure/repositories/abstraction/ITeamRepository';

export const departmentNotFound = (): NotFoundError => new NotFoundError('Department not found.');
export const teamNotFound = (): NotFoundError => new NotFoundError('Team not found.');
export const departmentNameConflict = (): ConflictError =>
  new ConflictError('DEPARTMENT_NAME_CONFLICT', 'A department with this name already exists.');
export const teamNameConflict = (): ConflictError =>
  new ConflictError('TEAM_NAME_CONFLICT', 'This department already has a team with this name.');

const forbidden = (message: string): ForbiddenError =>
  new ForbiddenError('FORBIDDEN_OPERATION', message);

const levelOf = (actor: Actor): UserLevel => actor.level ?? 'member';
const isCompanyWide = (actor: Actor): boolean => ['owner', 'admin'].includes(levelOf(actor));

/** Departments are managed by owners and admins only. */
export function assertCanManageDepartments(actor: Actor): void {
  if (!isCompanyWide(actor)) throw forbidden('Only the owner or an admin can manage departments.');
}

/** Teams: owners and admins anywhere, a department head only in the departments they head. */
export function canManageTeamsOf(actor: Actor, department: Department): boolean {
  if (isCompanyWide(actor)) return true;
  return levelOf(actor) === 'department_head' && department.headUserId === actor.userId;
}

export function assertCanManageTeamsOf(actor: Actor, department: Department): void {
  if (!canManageTeamsOf(actor, department)) {
    throw forbidden('You can only manage teams in departments you head.');
  }
}

/** A department head: an active `department_head` the caller may see (422 on headUserId otherwise). */
export function assertHeadCandidate(candidate: TenantUserReadModel | null): void {
  if (!candidate || candidate.status !== 'active' || candidate.level !== 'department_head') {
    throw ValidationFailedError.forField('headUserId', 'Choose an active department head.');
  }
}

/** A team member: an active, non-owner user the caller may see (422 on userId otherwise). */
export function assertMemberCandidate(candidate: TenantUserReadModel | null): void {
  if (!candidate || candidate.status !== 'active' || candidate.isOwner) {
    throw ValidationFailedError.forField('userId', 'Choose an active user you manage.');
  }
}

/** Teams a new user joins: every one must be an active team the caller may manage (422 on teamIds). */
export async function assertManageableTeams(
  actor: Actor,
  organizationId: string,
  teamIds: readonly string[],
  teams: ITeamRepository,
  departments: IDepartmentRepository,
): Promise<void> {
  for (const teamId of teamIds) {
    const team = await teams.findById(organizationId, teamId);
    const department = team ? await departments.findById(organizationId, team.departmentId) : null;
    if (!department || !canManageTeamsOf(actor, department)) {
      throw ValidationFailedError.forField('teamIds', 'One or more teams cannot be used.');
    }
  }
}

/** An active team in an active department that the caller may manage (404, then 403). */
export async function findManagedTeam(
  actor: Actor,
  organizationId: string,
  teamId: string,
  teams: ITeamRepository,
  departments: IDepartmentRepository,
): Promise<Team> {
  const team = await teams.findById(organizationId, teamId);
  const department = team ? await departments.findById(organizationId, team.departmentId) : null;
  if (!team || !department) throw teamNotFound();
  assertCanManageTeamsOf(actor, department);
  return team;
}
