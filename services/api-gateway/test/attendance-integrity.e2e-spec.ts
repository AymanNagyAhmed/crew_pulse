import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

describe('Attendance integrity (e2e)', () => {
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
    process.env.ATTENDANCE_REQUIRE_STATION = 'true';
    process.env.ATTENDANCE_STATION_VENUES = 'door_e2e:ven_e2e';

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

  it('rejects check-in without station when required', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/check-ins')
      .send({
        imageBase64: 'a'.repeat(16),
        venueId: 'ven_e2e',
        shiftId: 'shf_e2e',
        direction: 'in',
      })
      .expect(403);
    expect(res.body.error.code).toBe('STATION_REQUIRED');
  });

  it('writes override to audit only', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/overrides')
      .send({
        venueId: 'ven_e2e',
        shiftId: 'shf_e2e',
        workerId: 'wrk_e2e',
        direction: 'in',
        actorId: 'sup_e2e',
        reason: 'supervisor door override after pad fail',
      })
      .expect(201);

    expect(res.body.data.payrollWritten).toBe(false);
    expect(res.body.data.auditId).toMatch(/^aud_/);

    const audit = await request(app.getHttpServer())
      .get('/v1/attendance/audit')
      .expect(200);
    expect(audit.body.data.total).toBeGreaterThanOrEqual(1);
    expect(
      audit.body.data.items.some(
        (row: { id: string }) => row.id === res.body.data.auditId,
      ),
    ).toBe(true);
  });
});
