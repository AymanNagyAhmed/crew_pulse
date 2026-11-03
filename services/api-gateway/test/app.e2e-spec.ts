import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /v1/health returns success envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.message).toBe('api-gateway healthy');
    expect(res.body.data).toMatchObject({
      service: 'api-gateway',
      status: 'ok',
    });
    expect(res.body.meta.requestId).toMatch(/^req_/);
    expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
  });

  it('echoes inbound x-request-id', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/health')
      .set('x-request-id', 'req_test123')
      .expect(200);

    expect(res.body.meta.requestId).toBe('req_test123');
    expect(res.headers['x-request-id']).toBe('req_test123');
  });

  it('unknown route returns failure envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/does-not-exist')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.error.code).toBeTruthy();
    expect(res.body.meta.requestId).toBeTruthy();
  });
});
