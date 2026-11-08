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

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('Capture risk policy (e2e)', () => {
  let app: INestApplication<App>;
  let queue: Queue<AttendanceCheckInJob>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://test:test@localhost:15434/crewpulse';
    process.env.VISION_ENGINE_URL =
      process.env.VISION_ENGINE_URL ?? 'http://localhost:8000';
    process.env.API_GATEWAY_PORT = '3000';
    process.env.CAPTURE_PAYROLL_ALLOWED_SOURCES = 'managed_station';

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

  it('rejects remote selfie without step-up or review', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/check-ins')
      .send({
        imageBase64: TINY_PNG,
        venueId: 'ven_c12',
        shiftId: 'shf_c12',
        direction: 'in',
        captureSource: 'remote_selfie',
      })
      .expect(403);
    expect(res.body.error.code).toBe('CAPTURE_STEP_UP_REQUIRED');
  });

  it('accepts high-risk path with acceptReview', async () => {
    const key = `c12-review-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/check-ins')
      .set('Idempotency-Key', key)
      .send({
        imageBase64: TINY_PNG,
        venueId: 'ven_c12',
        shiftId: 'shf_c12',
        direction: 'in',
        captureSource: 'mobile_byod',
        acceptReview: true,
      })
      .expect(202);
    expect(res.body.data.forceReview).toBe(true);
    expect(res.body.data.riskTier).toBe('high');
  });
});
