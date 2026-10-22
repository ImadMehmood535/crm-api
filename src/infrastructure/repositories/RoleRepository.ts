import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { RoleModel } from '@domain/aggregates/RoleAggregate/RoleModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IRoleRepository, OWNER_ROLE_CODE } from './abstraction/IRoleRepository';

@Injectable()
export class RoleRepository implements IRoleRepository {
  constructor(@InjectModel(RoleModel) private readonly roleModel: typeof RoleModel) {}

  async createOwnerRole(organizationId: string, tx?: Tx): Promise<string> {
    const row = await this.roleModel.create(
      {
        organizationId,
        code: OWNER_ROLE_CODE,
        name: 'Developer Super User',
        description: 'Company owner: holds every permission.',
        isSystemRole: true,
        isActive: true,
      },
      { transaction: tx as Transaction },
    );
    return row.id;
  }

  async findPlatformRoleId(code: string): Promise<string | null> {
    const row = await this.roleModel.findOne({ where: { organizationId: null, code } });
    return row?.id ?? null;
  }
}
