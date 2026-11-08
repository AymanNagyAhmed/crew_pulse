import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

describe('Edge sync (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://test:test@localhost:15434/crewpulse';
    process.env.VISION_ENGINE_URL =
      process.env.VISION_ENGINE_URL ?? 'http://localhost:8000';
    process.env.API_GATEWAY_PORT = '3000';

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
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('syncs offline punches idempotently', async () => {
    const key = `dev_evt_e2e_${Date.now()}`;
    const body = {
      venueId: 'ven_edge',
      edgeNodeId: 'edge_e2e',
      punches: [
        {
          deviceEventId: key,
          workerId: 'wrk_edge',
          shiftId: 'shf_edge',
          direction: 'in',
          matchedAtLocal: new Date().toISOString(),
          score: 0.88,
          uplink: 'metadata',
        },
      ],
    };

    const first = await request(app.getHttpServer())
      .post('/v1/edge/sync/punches')
      .send(body)
      .expect(200);
    expect(first.body.data.written).toBe(1);
    expect(first.body.data.serverAuthority).toBe(true);
    const attendanceId = first.body.data.items[0].attendanceId;

    const second = await request(app.getHttpServer())
      .post('/v1/edge/sync/punches')
      .send(body)
      .expect(200);
    expect(second.body.data.duplicates).toBe(1);
    expect(second.body.data.items[0].attendanceId).toBe(attendanceId);

    const get = await request(app.getHttpServer())
      .get(`/v1/edge/punches/${key}`)
      .expect(200);
    expect(get.body.data.id).toBe(attendanceId);
  }, 30_000);
});
