import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AuthPersistenceModule } from '@infrastructure/persistence/AuthPersistenceModule';

import { GetMeQueryHandler } from './features/getme/GetMeQueryHandler';
import { LoginCommandHandler } from './features/login/LoginCommandHandler';
import { LogoutCommandHandler } from './features/logout/LogoutCommandHandler';
import { RefreshCommandHandler } from './features/refresh/RefreshCommandHandler';
import { ResetPasswordCommandHandler } from './features/resetpassword/ResetPasswordCommandHandler';
import { ResolveActorQueryHandler } from './features/resolveactor/ResolveActorQueryHandler';
import { SessionIssuer } from './SessionIssuer';

@Module({
  imports: [CqrsModule, AuthPersistenceModule],
  providers: [
    SessionIssuer,
    LoginCommandHandler,
    RefreshCommandHandler,
    LogoutCommandHandler,
    ResetPasswordCommandHandler,
    GetMeQueryHandler,
    ResolveActorQueryHandler,
  ],
  exports: [SessionIssuer],
})
export class AuthModule {}
