import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { Department } from '@domain/aggregates/DepartmentAggregate/Department';
import { DepartmentModel } from '@domain/aggregates/DepartmentAggregate/DepartmentModel';
import { TeamModel } from '@domain/aggregates/TeamAggregate/TeamModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IDepartmentRepository } from './abstraction/IDepartmentRepository';

@Injectable()
export class DepartmentRepository implements IDepartmentRepository {
  constructor(
    @InjectModel(DepartmentModel) private readonly departmentModel: typeof DepartmentModel,
    @InjectModel(TeamModel) private readonly teamModel: typeof TeamModel,
  ) {}

  async save(department: Department, tx?: Tx): Promise<Department> {
    const row = await this.departmentModel.create(
      {
        organizationId: department.organizationId,
        createdBy: department.createdBy,
        ...this.columns(department),
      },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async update(department: Department, tx?: Tx): Promise<void> {
    await this.departmentModel.update(this.columns(department), {
      where: { id: department.id as string },
      transaction: tx as Transaction,
    });
  }

  async findById(organizationId: string, id: string): Promise<Department | null> {
    const row = await this.departmentModel.findOne({
      where: { organizationId, id, isActive: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async activeNameExists(
    organizationId: string,
    nameKey: string,
    exceptId?: string,
  ): Promise<boolean> {
    const where = {
      organizationId,
      nameKey,
      isActive: true,
      ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
    };
    return (await this.departmentModel.count({ where })) > 0;
  }

  async hasActiveTeams(id: string): Promise<boolean> {
    return (await this.teamModel.count({ where: { departmentId: id, isActive: true } })) > 0;
  }

  private columns(department: Department): Partial<DepartmentModel> {
    return {
      name: department.name,
      nameKey: department.nameKey,
      headUserId: department.headUserId,
      isActive: department.isActive,
    };
  }

  private toDomain(row: DepartmentModel): Department {
    return Department.rehydrate(row.id, row.organizationId, row.name, row.headUserId, row.isActive);
  }
}
