import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { OrganizationModel } from '@domain/aggregates/OrganizationAggregate/OrganizationModel';
import { RoleModel } from '@domain/aggregates/RoleAggregate/RoleModel';
import { SessionModel } from '@domain/aggregates/SessionAggregate/SessionModel';
import { UserCredentialModel } from '@domain/aggregates/UserAggregate/UserCredentialModel';
import { UserModel } from '@domain/aggregates/UserAggregate/UserModel';
import { UserRoleModel } from '@domain/aggregates/UserAggregate/UserRoleModel';

import { AUTH_QUERIES } from '../queries/abstraction/IAuthQueries';
import { AuthQueries } from '../queries/AuthQueries';
import { SESSION_REPOSITORY } from '../repositories/abstraction/ISessionRepository';
import { USER_REPOSITORY } from '../repositories/abstraction/IUserRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ACCESS_TOKENS } from '../security/abstraction/IAccessTokens';
import { PASSWORD_HASHER } from '../security/abstraction/IPasswordHasher';
import { REFRESH_TOKENS } from '../security/abstraction/IRefreshTokens';
import { JwtAccessTokens } from '../security/JwtAccessTokens';
import { RefreshTokens } from '../security/RefreshTokens';
import { ScryptPasswordHasher } from '../security/ScryptPasswordHasher';

@Module({
  imports: [
    SequelizeModule.forFeature([
      OrganizationModel,
      UserModel,
      UserCredentialModel,
      UserRoleModel,
      RoleModel,
      SessionModel,
    ]),
  ],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: SESSION_REPOSITORY, useClass: SessionRepository },
    { provide: AUTH_QUERIES, useClass: AuthQueries },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: ACCESS_TOKENS, useClass: JwtAccessTokens },
    { provide: REFRESH_TOKENS, useClass: RefreshTokens },
  ],
  exports: [
    USER_REPOSITORY,
    SESSION_REPOSITORY,
    AUTH_QUERIES,
    PASSWORD_HASHER,
    ACCESS_TOKENS,
    REFRESH_TOKENS,
  ],
})
export class AuthPersistenceModule {}
