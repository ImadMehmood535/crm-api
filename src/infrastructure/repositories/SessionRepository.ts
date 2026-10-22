import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { Session } from '@domain/aggregates/SessionAggregate/Session';
import { SessionModel } from '@domain/aggregates/SessionAggregate/SessionModel';

import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';
import { ISessionRepository, NewSession, RevokeReason } from './abstraction/ISessionRepository';

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(@InjectModel(SessionModel) private readonly sessionModel: typeof SessionModel) {}

  async create(session: NewSession, tx?: Tx): Promise<Session> {
    const row = await this.sessionModel.create({ ...session }, { transaction: tx as Transaction });
    return this.toDomain(row);
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.sessionModel.findByPk(id);
    return row ? this.toDomain(row) : null;
  }

  async findByTokenHash(hash: string): Promise<Session | null> {
    const row = await this.sessionModel.findOne({ where: { refreshTokenHash: hash } });
    return row ? this.toDomain(row) : null;
  }

  rotate(currentId: string, next: NewSession): Promise<Session | null> {
    const sequelize = this.sessionModel.sequelize!;
    return sequelize.transaction(async (transaction) => {
      const current = await this.sessionModel.findByPk(currentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!current || !this.toDomain(current).isActive()) return null;
      const successor = await this.sessionModel.create({ ...next }, { transaction });
      await current.update(
        {
          replacedBy: successor.id,
          revokedAt: new Date(),
          revokedReason: 'rotated',
          lastUsedAt: new Date(),
        },
        { transaction },
      );
      return this.toDomain(successor);
    });
  }

  async isFamilyActive(familyId: string, userId: string): Promise<boolean> {
    const count = await this.sessionModel.count({
      where: { familyId, userId, revokedAt: { [Op.is]: null }, expiresAt: { [Op.gt]: new Date() } },
    });
    return count > 0;
  }

  async revokeFamily(familyId: string, reason: RevokeReason): Promise<void> {
    await this.sessionModel.update(
      { revokedAt: new Date(), revokedReason: reason },
      { where: { familyId, revokedAt: { [Op.is]: null } } },
    );
  }

  async revokeAllForUser(userId: string, reason: RevokeReason, tx?: Tx): Promise<void> {
    await this.sessionModel.update(
      { revokedAt: new Date(), revokedReason: reason },
      { where: { userId, revokedAt: { [Op.is]: null } }, transaction: tx as Transaction },
    );
  }

  private toDomain(row: SessionModel): Session {
    return Session.rehydrate(
      row.id,
      row.userId,
      row.familyId,
      row.expiresAt,
      row.revokedAt,
      row.replacedBy,
    );
  }
}
