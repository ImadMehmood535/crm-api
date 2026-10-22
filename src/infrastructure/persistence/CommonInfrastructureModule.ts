import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { AuditLogModel } from '@domain/aggregates/AuditAggregate/AuditLogModel';
import { MailOutboxModel } from '@domain/aggregates/MailAggregate/MailOutboxModel';

import { AUDIT_LOG } from '../audit/abstraction/IAuditLog';
import { AuditLog } from '../audit/AuditLog';
import { MAILER } from '../mail/abstraction/IMailer';
import { ConsoleMailer } from '../mail/ConsoleMailer';

/** Cross-cutting writers every module may use: the audit trail and the mailer. */
@Global()
@Module({
  imports: [SequelizeModule.forFeature([AuditLogModel, MailOutboxModel])],
  providers: [
    { provide: AUDIT_LOG, useClass: AuditLog },
    { provide: MAILER, useClass: ConsoleMailer },
  ],
  exports: [AUDIT_LOG, MAILER],
})
export class CommonInfrastructureModule {}
