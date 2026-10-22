import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { Organization } from '@domain/aggregates/OrganizationAggregate/Organization';
import { OrganizationModel } from '@domain/aggregates/OrganizationAggregate/OrganizationModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IOrganizationRepository } from './abstraction/IOrganizationRepository';

@Injectable()
export class OrganizationRepository implements IOrganizationRepository {
  constructor(
    @InjectModel(OrganizationModel) private readonly organizationModel: typeof OrganizationModel,
  ) {}

  async save(organization: Organization, tx?: Tx): Promise<Organization> {
    const row = await this.organizationModel.create(
      {
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdBy: organization.createdBy,
      },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async update(organization: Organization, tx?: Tx): Promise<void> {
    await this.organizationModel.update(
      { name: organization.name, status: organization.status },
      { where: { id: organization.id as string }, transaction: tx as Transaction },
    );
  }

  async findById(id: string): Promise<Organization | null> {
    const row = await this.organizationModel.findByPk(id);
    return row ? this.toDomain(row) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await this.organizationModel.count({ where: { slug } })) > 0;
  }

  private toDomain(row: OrganizationModel): Organization {
    return Organization.rehydrate(row.id, row.name, row.slug, row.status, row.createdBy);
  }
}
