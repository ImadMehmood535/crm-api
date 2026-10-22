import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';

import { User } from '@domain/aggregates/UserAggregate/User';
import { UserCredentialModel } from '@domain/aggregates/UserAggregate/UserCredentialModel';
import { UserModel } from '@domain/aggregates/UserAggregate/UserModel';
import { UserRoleModel } from '@domain/aggregates/UserAggregate/UserRoleModel';

import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { Credential, IUserRepository } from './abstraction/IUserRepository';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(UserModel) private readonly userModel: typeof UserModel,
    @InjectModel(UserCredentialModel)
    private readonly credentialModel: typeof UserCredentialModel,
    @InjectModel(UserRoleModel) private readonly userRoleModel: typeof UserRoleModel,
  ) {}

  async save(user: User, passwordHash: string, mustReset: boolean, tx?: Tx): Promise<User> {
    const transaction = tx as Transaction;
    const row = await this.userModel.create(
      {
        organizationId: user.organizationId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        isSystem: false,
        createdBy: user.createdBy,
      },
      { transaction },
    );
    await this.credentialModel.create(
      { userId: row.id, passwordHash, mustResetPassword: mustReset, passwordUpdatedAt: new Date() },
      { transaction },
    );
    return this.toDomain(row);
  }

  async update(user: User, tx?: Tx): Promise<void> {
    await this.userModel.update(
      {
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        deactivatedAt: user.status === 'active' ? null : new Date(),
      },
      { where: { id: user.id as string }, transaction: tx as Transaction },
    );
  }

  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string | null,
    tx?: Tx,
  ): Promise<void> {
    await this.userRoleModel.create(
      { userId, roleId, assignedBy, assignedAt: new Date() },
      { transaction: tx as Transaction },
    );
  }

  async emailExists(email: string): Promise<boolean> {
    return (await this.userModel.count({ where: { email: email.trim().toLowerCase() } })) > 0;
  }

  async countOtherActivePlatformSuperUsers(exceptUserId: string): Promise<number> {
    const rows = await this.userModel.sequelize!.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id AND r.organization_id IS NULL AND r.code = 'platform_super_user'
       WHERE u.organization_id IS NULL AND u.status = 'active' AND u.id <> :exceptUserId`,
      { replacements: { exceptUserId }, type: QueryTypes.SELECT },
    );
    return rows[0].n;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.userModel.findByPk(id);
    return row ? this.toDomain(row) : null;
  }

  async findTenantUser(organizationId: string, id: string): Promise<User | null> {
    const row = await this.userModel.findOne({ where: { organizationId, id } });
    return row ? this.toDomain(row) : null;
  }

  async replaceRoles(
    userId: string,
    roleIds: readonly string[],
    assignedBy: string,
    tx?: Tx,
  ): Promise<void> {
    const transaction = tx as Transaction;
    await this.userRoleModel.destroy({ where: { userId }, transaction });
    await this.userRoleModel.bulkCreate(
      roleIds.map((roleId) => ({ userId, roleId, assignedBy, assignedAt: new Date() })),
      { transaction },
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.userModel.findOne({ where: { email: email.trim().toLowerCase() } });
    return row ? this.toDomain(row) : null;
  }

  async findCredential(userId: string): Promise<Credential | null> {
    const row = await this.credentialModel.findByPk(userId);
    return row
      ? { passwordHash: row.passwordHash, mustResetPassword: row.mustResetPassword }
      : null;
  }

  async setPassword(
    userId: string,
    passwordHash: string,
    mustReset: boolean,
    tx?: Tx,
  ): Promise<void> {
    await this.credentialModel.upsert(
      { userId, passwordHash, mustResetPassword: mustReset, passwordUpdatedAt: new Date() },
      { transaction: tx as Transaction },
    );
  }

  async markLoggedIn(userId: string): Promise<void> {
    await this.userModel.update({ lastLoginAt: new Date() }, { where: { id: userId } });
  }

  private toDomain(row: UserModel): User {
    return User.rehydrate(
      row.id,
      row.organizationId,
      row.email,
      row.firstName,
      row.lastName,
      row.status,
      row.createdBy,
    );
  }
}
