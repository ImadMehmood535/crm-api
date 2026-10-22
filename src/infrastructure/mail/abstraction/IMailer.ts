import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

export const MAILER = Symbol('MAILER');

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface IMailer {
  send(message: MailMessage, tx?: Tx): Promise<void>;
}
