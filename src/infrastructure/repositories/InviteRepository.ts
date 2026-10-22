import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, WhereOptions } from 'sequelize';

import { Invite } from '@domain/aggregates/InviteAggregate/Invite';
import { InviteModel } from '@domain/aggregates/InviteAggregate/InviteModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IInviteRepository } from './abstraction/IInviteRepository';

@Injectable()
export class InviteRepository implements IInviteRepository {
  constructor(@InjectModel(InviteModel) private readonly inviteModel: typeof InviteModel) {}

  async save(invite: Invite, tx?: Tx): Promise<Invite> {
    const row = await this.inviteModel.create(
      {
        email: invite.email,
        firstName: invite.firstName,
        lastName: invite.lastName,
        organizationName: invite.organizationName,
        slug: invite.slug,
        tokenHash: invite.tokenHash,
        status: invite.status,
        expiresAt: invite.expiresAt,
        invitedBy: invite.invitedBy,
        acceptedAt: invite.acceptedAt,
      },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async update(invite: Invite, tx?: Tx): Promise<void> {
    await this.inviteModel.update(
      {
        tokenHash: invite.tokenHash,
        status: invite.status,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
      },
      { where: { id: invite.id as string }, transaction: tx as Transaction },
    );
  }

  async findById(id: string): Promise<Invite | null> {
    const row = await this.inviteModel.findByPk(id);
    return row ? this.toDomain(row) : null;
  }

  async findByTokenHash(tokenHash: string, tx?: Tx): Promise<Invite | null> {
    const transaction = tx as Transaction | undefined;
    const row = await this.inviteModel.findOne({
      where: { tokenHash },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    return row ? this.toDomain(row) : null;
  }

  livePendingEmailExists(email: string): Promise<boolean> {
    return this.exists({ email: email.trim().toLowerCase() });
  }

  livePendingSlugExists(slug: string, exceptInviteId?: string): Promise<boolean> {
    return this.exists(exceptInviteId ? { slug, id: { [Op.ne]: exceptInviteId } } : { slug });
  }

  private async exists(where: WhereOptions<InviteModel>): Promise<boolean> {
    const live = { status: 'pending', expiresAt: { [Op.gt]: new Date() } };
    return (await this.inviteModel.count({ where: { ...where, ...live } })) > 0;
  }

  private toDomain(row: InviteModel): Invite {
    return Invite.rehydrate(
      row.id,
      row.email,
      row.firstName,
      row.lastName,
      row.organizationName,
      row.slug,
      row.tokenHash,
      row.status,
      row.expiresAt,
      row.invitedBy,
      row.acceptedAt,
    );
  }
}
