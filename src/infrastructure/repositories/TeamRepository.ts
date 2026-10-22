import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { Team } from '@domain/aggregates/TeamAggregate/Team';
import { TeamMemberModel } from '@domain/aggregates/TeamAggregate/TeamMemberModel';
import { TeamModel } from '@domain/aggregates/TeamAggregate/TeamModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { ITeamRepository } from './abstraction/ITeamRepository';

@Injectable()
export class TeamRepository implements ITeamRepository {
  constructor(
    @InjectModel(TeamModel) private readonly teamModel: typeof TeamModel,
    @InjectModel(TeamMemberModel) private readonly memberModel: typeof TeamMemberModel,
  ) {}

  async save(team: Team, tx?: Tx): Promise<Team> {
    const row = await this.teamModel.create(
      {
        organizationId: team.organizationId,
        departmentId: team.departmentId,
        createdBy: team.createdBy,
        ...this.columns(team),
      },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async update(team: Team, tx?: Tx): Promise<void> {
    await this.teamModel.update(this.columns(team), {
      where: { id: team.id as string },
      transaction: tx as Transaction,
    });
  }

  async findById(organizationId: string, id: string): Promise<Team | null> {
    const row = await this.teamModel.findOne({ where: { organizationId, id, isActive: true } });
    return row ? this.toDomain(row) : null;
  }

  async activeNameExists(
    departmentId: string,
    nameKey: string,
    exceptId?: string,
  ): Promise<boolean> {
    const where = {
      departmentId,
      nameKey,
      isActive: true,
      ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
    };
    return (await this.teamModel.count({ where })) > 0;
  }

  async hasMembers(id: string): Promise<boolean> {
    return (await this.memberModel.count({ where: { teamId: id } })) > 0;
  }

  async addMember(teamId: string, userId: string, addedBy: string, tx?: Tx): Promise<void> {
    await this.memberModel.findOrCreate({
      where: { teamId, userId },
      defaults: { teamId, userId, addedBy },
      transaction: tx as Transaction,
    });
  }

  async removeMember(teamId: string, userId: string, tx?: Tx): Promise<void> {
    await this.memberModel.destroy({ where: { teamId, userId }, transaction: tx as Transaction });
  }

  private columns(team: Team): Partial<TeamModel> {
    return { name: team.name, nameKey: team.nameKey, isActive: team.isActive };
  }

  private toDomain(row: TeamModel): Team {
    return Team.rehydrate(row.id, row.organizationId, row.departmentId, row.name, row.isActive);
  }
}
