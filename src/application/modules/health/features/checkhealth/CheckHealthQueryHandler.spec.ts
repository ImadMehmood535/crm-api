import { CheckHealthQueryHandler } from './CheckHealthQueryHandler';

describe('CheckHealthQueryHandler', () => {
  it('should report ok/up when the database answers', async () => {
    const handler = new CheckHealthQueryHandler({ isUp: () => Promise.resolve(true) });

    expect(await handler.execute()).toEqual({ status: 'ok', db: 'up' });
  });

  it('should report error/down when the database does not answer', async () => {
    const handler = new CheckHealthQueryHandler({ isUp: () => Promise.resolve(false) });

    expect(await handler.execute()).toEqual({ status: 'error', db: 'down' });
  });
});
