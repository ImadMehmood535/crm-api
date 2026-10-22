import {
  Body,
  Controller,
  Get,
  INestApplication,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';

import { PageQuery } from '../src/api/common/PageQuery';
import { Public } from '../src/api/common/Public';
import { ParseUuidPipe } from '../src/api/pipes/ParseUuidPipe';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DATABASE_HEALTH } from '../src/infrastructure/persistence/abstraction/IDatabaseHealth';
import { PagedResult } from '../src/shared/utils/Pagination';

class ProbeOwner {
  @IsEmail()
  email!: string;
}

class ProbeBody {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @ValidateNested()
  @Type(() => ProbeOwner)
  superUser!: ProbeOwner;
}

const ROWS = Array.from({ length: 45 }, (_, i) => ({ n: i + 1 }));

/** Test-only endpoints that exercise the shared HTTP conventions. */
@Public()
@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() body: ProbeBody): ProbeBody {
    return body;
  }

  @Post('empty')
  empty(): void {}

  @Get('list')
  list(@Query() query: PageQuery): PagedResult<{ n: number }> {
    const start = (query.page - 1) * query.pageSize;
    return PagedResult.of(ROWS.slice(start, start + query.pageSize), query, ROWS.length);
  }

  @Get('now')
  now(): { createdAt: Date } {
    return { createdAt: new Date(Date.UTC(2026, 9, 23, 1, 2, 3, 456)) };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }

  @Get(':id')
  one(@Param('id', ParseUuidPipe) id: string): { id: string } {
    return { id };
  }
}

async function createApp(dbUp = true): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [ProbeController],
  });
  if (!dbUp)
    builder.overrideProvider(DATABASE_HEALTH).useValue({ isUp: () => Promise.resolve(false) });
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('API conventions (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(() => app.close());

  describe('versioned base path', () => {
    it('should serve business routes under /api/v1', async () => {
      await request(app.getHttpServer()).get('/api/v1/probe/now').expect(200);
    });

    it('should answer 404 in the envelope for an unversioned business route', async () => {
      const res = await request(app.getHttpServer()).get('/probe/now').expect(404);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    });
  });

  describe('success envelope', () => {
    it('should wrap a resource in data', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'Ali', email: 'ali@example.com', superUser: { email: 'o@example.com' } })
        .expect(201);

      expect(res.body).toEqual({
        success: true,
        data: { name: 'Ali', email: 'ali@example.com', superUser: { email: 'o@example.com' } },
      });
    });

    it('should return data: null when there is no payload', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/probe/empty').expect(201);

      expect(res.body).toEqual({ success: true, data: null });
    });
  });

  describe('paginated lists', () => {
    it('should default to page 1 and 20 items', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/probe/list').expect(200);

      expect(res.body.data).toHaveLength(20);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 45 });
    });

    it('should answer 422 for pageSize above 100', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/probe/list?pageSize=101')
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['pageSize']);
    });

    it('should return an empty page and the full total past the end', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/probe/list?page=9').expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(45);
    });
  });

  describe('validation failures', () => {
    it('should list every bad field, nested ones in dot notation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: '', email: 'nope', superUser: { email: 'bad' } })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([
        'name',
        'email',
        'superUser.email',
      ]);
    });

    it('should reject an unknown property', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'A', email: 'a@b.co', superUser: { email: 'o@b.co' }, role: 'admin' })
        .expect(422);

      expect(res.body.error.details).toEqual([
        { field: 'role', messages: ['property role should not exist'] },
      ]);
    });
  });

  describe('malformed requests', () => {
    it('should answer 400 BAD_REQUEST for broken JSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('identifiers', () => {
    it('should answer 404 NOT_FOUND for a malformed id', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/probe/abc').expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('timestamps', () => {
    it('should serialise dates as ISO-8601 UTC', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/probe/now').expect(200);

      expect(res.body.data.createdAt).toBe('2026-10-23T01:02:03.456Z');
    });
  });

  describe('unexpected failures', () => {
    it('should answer 500 INTERNAL_ERROR without internal details', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const res = await request(app.getHttpServer()).get('/api/v1/probe/boom').expect(500);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    });
  });

  describe('health probe', () => {
    it('should answer 200 ok/up, unversioned and without the envelope', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toEqual({ status: 'ok', db: 'up' });
    });

    it('should answer 503 error/down when the database is unreachable', async () => {
      const downApp = await createApp(false);

      const res = await request(downApp.getHttpServer()).get('/health').expect(503);

      expect(res.body).toEqual({ status: 'error', db: 'down' });
      await downApp.close();
    });
  });
});
