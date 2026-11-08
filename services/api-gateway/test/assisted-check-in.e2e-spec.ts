import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import type { AttendanceCheckInJob } from '../src/modules/attendance/attendance-check-in.job.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../src/modules/queues/queue.constants.js';

describe('Assisted check-in (e2e)', () => {
  let app: INestApplication<App>;
  let queue: Queue<AttendanceCheckInJob>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://crewpulse:crewpulse_dev_change_me@localhost:15434/crewpulse';
    process.env.VISION_ENGINE_URL =
      process.env.VISION_ENGINE_URL ?? 'http://localhost:8000';
    process.env.API_GATEWAY_PORT = '3000';
    process.env.ASSISTED_SUPERVISOR_PIN = 'dev-pin-change-me';
    process.env.ASSISTED_QR_TOKENS = 'dev-qr-change-me';

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

    queue = app.get(getQueueToken(ATTENDANCE_CHECK_IN_QUEUE));
  }, 30_000);

  afterAll(async () => {
    await queue?.obliterate({ force: true }).catch(() => undefined);
    await app?.close();
  });

  it('POST /v1/attendance/assisted-check-ins records PIN punch for occlusion fallback', async () => {
    const key = `e2e-assist-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/assisted-check-ins')
      .set('Idempotency-Key', key)
      .send({
        venueId: 'ven_ppe',
        shiftId: 'shf_ppe',
        direction: 'in',
        workerId: 'wrk_masked',
        method: 'supervisor_pin',
        credential: 'dev-pin-change-me',
        reason: 'face_occluded',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(201);
    expect(res.body.data.state).toBe('recorded');
    expect(res.body.data.method).toBe('supervisor_pin');
    expect(res.body.data.reason).toBe('face_occluded');
    expect(res.body.data.idempotencyKey).toBe(key);

    const again = await request(app.getHttpServer())
      .post('/v1/attendance/assisted-check-ins')
      .set('Idempotency-Key', key)
      .send({
        venueId: 'ven_ppe',
        shiftId: 'shf_ppe',
        direction: 'in',
        workerId: 'wrk_masked',
        method: 'supervisor_pin',
        credential: 'dev-pin-change-me',
        reason: 'face_occluded',
      })
      .expect(201);

    expect(again.body.data.attendanceId).toBe(res.body.data.attendanceId);
  });

  it('rejects bad QR credentials with 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/assisted-check-ins')
      .send({
        venueId: 'ven_ppe',
        shiftId: 'shf_ppe',
        direction: 'in',
        workerId: 'wrk_masked',
        method: 'qr',
        credential: 'not-a-valid-token',
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ASSISTED_CREDENTIAL_INVALID');
  });
});
