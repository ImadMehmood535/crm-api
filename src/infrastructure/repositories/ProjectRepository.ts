import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { Project } from '@domain/aggregates/ProjectAggregate/Project';
import { ProjectModel } from '@domain/aggregates/ProjectAggregate/ProjectModel';
import { UnitModel } from '@domain/aggregates/UnitAggregate/UnitModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IProjectRepository } from './abstraction/IProjectRepository';

@Injectable()
export class ProjectRepository implements IProjectRepository {
  constructor(
    @InjectModel(ProjectModel) private readonly projectModel: typeof ProjectModel,
    @InjectModel(UnitModel) private readonly unitModel: typeof UnitModel,
  ) {}

  async save(project: Project, tx?: Tx): Promise<Project> {
    const row = await this.projectModel.create(
      {
        organizationId: project.organizationId,
        createdBy: project.createdBy,
        ...this.columns(project),
      },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async update(project: Project, tx?: Tx): Promise<void> {
    await this.projectModel.update(this.columns(project), {
      where: { id: project.id as string },
      transaction: tx as Transaction,
    });
  }

  async findById(organizationId: string, id: string): Promise<Project | null> {
    const row = await this.projectModel.findOne({ where: { organizationId, id } });
    return row ? this.toDomain(row) : null;
  }

  async nameKeyExists(
    organizationId: string,
    nameKey: string,
    exceptId?: string,
  ): Promise<boolean> {
    const where = exceptId
      ? { organizationId, nameKey, id: { [Op.ne]: exceptId } }
      : { organizationId, nameKey };
    return (await this.projectModel.count({ where })) > 0;
  }

  async hasUnits(id: string): Promise<boolean> {
    return (await this.unitModel.count({ where: { projectId: id } })) > 0;
  }

  async delete(id: string, tx?: Tx): Promise<void> {
    await this.projectModel.destroy({ where: { id }, transaction: tx as Transaction });
  }

  private columns(project: Project): Partial<ProjectModel> {
    return {
      name: project.name,
      nameKey: project.nameKey,
      description: project.description,
      city: project.city,
      address: project.address,
      currency: project.currency,
      status: project.status,
      expectedCompletion: project.expectedCompletion,
    };
  }

  private toDomain(row: ProjectModel): Project {
    return Project.rehydrate(
      row.id,
      row.organizationId,
      row.name,
      row.description,
      row.city,
      row.address,
      row.currency,
      row.status,
      row.expectedCompletion,
    );
  }
}
