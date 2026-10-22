import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { User } from '@domain/aggregates/UserAggregate/User';
import { UserCredentialModel } from '@domain/aggregates/UserAggregate/UserCredentialModel';
import { UserModel } from '@domain/aggregates/UserAggregate/UserModel';

import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { Credential, IUserRepository } from './abstraction/IUserRepository';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(UserModel) private readonly userModel: typeof UserModel,
    @InjectModel(UserCredentialModel)
    private readonly credentialModel: typeof UserCredentialModel,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.userModel.findByPk(id);
    return row ? this.toDomain(row) : null;
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
    return User.rehydrate(row.id, row.organizationId, row.email, row.status);
  }
}
