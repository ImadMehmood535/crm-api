import { Team } from '@domain/aggregates/TeamAggregate/Team';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const TEAM_REPOSITORY = Symbol('TEAM_REPOSITORY');

export interface ITeamRepository {
  save(team: Team, tx?: Tx): Promise<Team>;
  update(team: Team, tx?: Tx): Promise<void>;
  /** Active teams only. */
  findById(organizationId: string, id: string): Promise<Team | null>;
  activeNameExists(departmentId: string, nameKey: string, exceptId?: string): Promise<boolean>;
  hasMembers(id: string): Promise<boolean>;
  /** Adding an existing member changes nothing. */
  addMember(teamId: string, userId: string, addedBy: string, tx?: Tx): Promise<void>;
  removeMember(teamId: string, userId: string, tx?: Tx): Promise<void>;
}
