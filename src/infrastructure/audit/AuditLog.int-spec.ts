import { TestingModule } from '@nestjs/testing';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { persistenceModule } from '../../../test/support/persistence';
import { IMailer, MAILER } from '../mail/abstraction/IMailer';
import { CommonInfrastructureModule } from '../persistence/CommonInfrastructureModule';
import { AUDIT_LOG, IAuditLog } from './abstraction/IAuditLog';

describe('AuditLog / ConsoleMailer', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let audit: IAuditLog;
  let mailer: IMailer;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([CommonInfrastructureModule]));
    audit = moduleRef.get(AUDIT_LOG);
    mailer = moduleRef.get(MAILER);
  });
  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should append a redacted entry that cannot be updated afterwards', async () => {
    await audit.record({
      actorUserId: null,
      action: 'invite.issued',
      entityType: 'invite',
      entityId: null,
      organizationId: null,
      newValues: { email: 'a@b.co', tokenHash: 'secret' },
      ip: '10.0.0.1',
    });

    const rows = await sequelize.query<{ new_values: unknown }>(
      'SELECT new_values FROM audit_logs',
      {
        type: QueryTypes.SELECT,
      },
    );
    expect(rows).toEqual([{ new_values: { email: 'a@b.co' } }]);
    await expect(sequelize.query("UPDATE audit_logs SET action = 'x'")).rejects.toThrow(
      'append-only',
    );
    await expect(sequelize.query('DELETE FROM audit_logs')).rejects.toThrow('append-only');
  });

  it('should store every message in the outbox', async () => {
    await mailer.send({ to: 'a@b.co', subject: 'Hello', text: 'Link: x' });

    const rows = await sequelize.query('SELECT to_email, subject, body FROM mail_outbox', {
      type: QueryTypes.SELECT,
    });
    expect(rows).toEqual([{ to_email: 'a@b.co', subject: 'Hello', body: 'Link: x' }]);
  });
});
