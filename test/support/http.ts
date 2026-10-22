import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import { PASSWORD } from './fixtures';

/** Logs in through the real endpoint and returns the access token. */
export async function loginToken(
  app: INestApplication<App>,
  email: string,
  password = PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

export const bearer = (token: string): [string, string] => ['Authorization', `Bearer ${token}`];
