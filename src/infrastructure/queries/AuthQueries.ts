import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';

import { OrganizationModel } from '@domain/aggregates/OrganizationAggregate/OrganizationModel';
import { UserCredentialModel } from '@domain/aggregates/UserAggregate/UserCredentialModel';
import { UserModel } from '@domain/aggregates/UserAggregate/UserModel';

import { AccountReadModel, IAuthQueries } from './abstraction/IAuthQueries';
import { effectivePermissionsSql } from './EffectivePermissionsSql';

const SUPER_USER_ROLES = ['platform_super_user', 'developer_super_user'];

const ACTIVE_ROLE_CODES_SQL = `
  SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = :userId AND r.is_active ORDER BY r.code`;

const PERMISSIONS_SQL = `SELECT code FROM (${effectivePermissionsSql(':userId')}) x ORDER BY code`;

@Injectable()
export class AuthQueries implements IAuthQueries {
  constructor(@InjectModel(UserModel) private readonly userModel: typeof UserModel) {}

  async findAccount(userId: string): Promise<AccountReadModel | null> {
    const row = await this.userModel.findByPk(userId, {
      include: [OrganizationModel, UserCredentialModel],
    });
    if (!row) return null;
    const [roles, permissions] = await Promise.all([
      this.codes(ACTIVE_ROLE_CODES_SQL, userId),
      this.codes(PERMISSIONS_SQL, userId),
    ]);
    const organization = row.organization;
    return {
      userStatus: row.status,
      organizationStatus: organization?.status ?? null,
      user: {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        plane: row.organizationId === null ? 'platform' : 'tenant',
        roles,
        isSuperUser: roles.some((code) => SUPER_USER_ROLES.includes(code)),
        organization: organization
          ? {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
              status: organization.status,
            }
          : null,
        mustResetPassword: row.credential?.mustResetPassword ?? false,
        permissions,
      },
    };
  }

  private async codes(sql: string, userId: string): Promise<string[]> {
    const rows = await this.userModel.sequelize!.query<{ code: string }>(sql, {
      replacements: { userId },
      type: QueryTypes.SELECT,
    });
    return rows.map((r) => r.code);
  }
}
