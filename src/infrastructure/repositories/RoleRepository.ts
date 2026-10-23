import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Transaction } from 'sequelize';

import { LEVEL_ROLE, RoleLevel } from '@shared/auth/LevelRoles';
import { Role } from '@domain/aggregates/RoleAggregate/Role';
import { RoleModel } from '@domain/aggregates/RoleAggregate/RoleModel';
import { RolePermissionModel } from '@domain/aggregates/RoleAggregate/RolePermissionModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IRoleRepository, OWNER_ROLE_CODE } from './abstraction/IRoleRepository';

@Injectable()
export class RoleRepository implements IRoleRepository {
  constructor(
    @InjectModel(RoleModel) private readonly roleModel: typeof RoleModel,
    @InjectModel(RolePermissionModel) private readonly grantModel: typeof RolePermissionModel,
  ) {}

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

  async levelRoleId(organizationId: string, level: RoleLevel, tx?: Tx): Promise<string> {
    const where = { organizationId, levelRole: level, isActive: true };
    const existing = await this.roleModel.findOne({ where, transaction: tx as Transaction });
    if (existing) return existing.id;
    const row = await this.roleModel.create(
      { ...where, ...LEVEL_ROLE[level], isSystemRole: false },
      { transaction: tx as Transaction },
    );
    return row.id;
  }

  async findPlatformRoleId(code: string): Promise<string | null> {
    const row = await this.roleModel.findOne({ where: { organizationId: null, code } });
    return row?.id ?? null;
  }

  async saveTenantRole(role: Role, grantedBy: string, tx?: Tx): Promise<Role> {
    const row = await this.roleModel.create(
      {
        organizationId: role.organizationId,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystemRole: false,
        isActive: role.isActive,
      },
      { transaction: tx as Transaction },
    );
    await this.insertGrants(row.id, role.permissions, grantedBy, tx);
    return this.toDomain(row, [...role.permissions]);
  }

  async updateTenantRole(role: Role, grantedBy: string, tx?: Tx): Promise<void> {
    const transaction = tx as Transaction;
    const id = role.id as string;
    await this.roleModel.update(
      { code: role.code, name: role.name, description: role.description, isActive: role.isActive },
      { where: { id }, transaction },
    );
    await this.grantModel.destroy({ where: { roleId: id }, transaction });
    await this.insertGrants(id, role.permissions, grantedBy, tx);
  }

  async findTenantRole(organizationId: string, id: string): Promise<Role | null> {
    const row = await this.roleModel.findOne({ where: { organizationId, id } });
    return row ? this.toDomain(row, await this.grantsOf(row.id)) : null;
  }

  async findActiveTenantRoles(organizationId: string, ids: readonly string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    const rows = await this.roleModel.findAll({
      where: { organizationId, id: { [Op.in]: [...ids] }, isActive: true },
    });
    return Promise.all(rows.map(async (row) => this.toDomain(row, await this.grantsOf(row.id))));
  }

  async activeCodeExists(
    organizationId: string,
    code: string,
    exceptId?: string,
  ): Promise<boolean> {
    const where = exceptId
      ? { organizationId, code, isActive: true, id: { [Op.ne]: exceptId } }
      : { organizationId, code, isActive: true };
    return (await this.roleModel.count({ where })) > 0;
  }

  async countHolders(roleId: string): Promise<number> {
    const rows = await this.roleModel.sequelize!.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM user_roles WHERE role_id = :roleId',
      { replacements: { roleId }, type: QueryTypes.SELECT },
    );
    return rows[0].n;
  }

  private async insertGrants(
    roleId: string,
    codes: readonly string[],
    grantedBy: string,
    tx?: Tx,
  ): Promise<void> {
    if (codes.length === 0) return;
    await this.roleModel.sequelize!.query(
      `INSERT INTO role_permissions (role_id, permission_id, granted_by)
       SELECT :roleId, p.id, :grantedBy FROM permissions p WHERE p.code IN (:codes)`,
      { replacements: { roleId, grantedBy, codes: [...codes] }, transaction: tx as Transaction },
    );
  }

  private async grantsOf(roleId: string): Promise<string[]> {
    const rows = await this.roleModel.sequelize!.query<{ code: string }>(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = :roleId ORDER BY p.code`,
      { replacements: { roleId }, type: QueryTypes.SELECT },
    );
    return rows.map((r) => r.code);
  }

  private toDomain(row: RoleModel, permissions: string[]): Role {
    return Role.rehydrate(
      row.id,
      row.organizationId as string,
      row.name,
      row.code,
      row.description,
      permissions,
      row.isSystemRole || row.levelRole !== null,
      row.isActive,
    );
  }
}
