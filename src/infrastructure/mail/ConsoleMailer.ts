import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { MailOutboxModel } from '@domain/aggregates/MailAggregate/MailOutboxModel';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { IMailer, MailMessage } from './abstraction/IMailer';

/**
 * No e-mail provider yet (by decision): every message is stored in mail_outbox and logged, so a
 * developer can follow invite links locally. An SMTP mailer can replace this behind IMailer.
 */
@Injectable()
export class ConsoleMailer implements IMailer {
  private readonly logger = new Logger('Mail');

  constructor(@InjectModel(MailOutboxModel) private readonly outboxModel: typeof MailOutboxModel) {}

  async send(message: MailMessage, tx?: Tx): Promise<void> {
    await this.outboxModel.create(
      { toEmail: message.to, subject: message.subject, body: message.text },
      { transaction: tx as Transaction },
    );
    this.logger.log(`to ${message.to}: ${message.subject}\n${message.text}`);
  }
}
