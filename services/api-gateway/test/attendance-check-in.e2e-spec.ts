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

describe('Attendance check-in (e2e)', () => {
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

  it('POST /v1/attendance/check-ins returns 202 with jobId without blocking on match', async () => {
    const key = `e2e-chk-${Date.now()}`;
    const started = Date.now();
    const res = await request(app.getHttpServer())
      .post('/v1/attendance/check-ins')
      .set('Idempotency-Key', key)
      .send({
        imageBase64: TINY_PNG,
        venueId: 'ven_e2e',
        shiftId: 'shf_e2e',
        direction: 'in',
        candidateWorkerIds: ['wrk_e2e'],
      })
      .expect(202);
    const elapsed = Date.now() - started;

    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(202);
    expect(res.body.data.jobId).toBe(key);
    expect(res.body.data.state).toBe('queued');
    expect(elapsed).toBeLessThan(1500);

    const status = await request(app.getHttpServer())
      .get(`/v1/attendance/jobs/${key}`)
      .expect(200);
    expect(status.body.data.jobId).toBe(key);
    expect([
      'queued',
      'matched',
      'needs_review',
      'no_match',
      'assisted_fallback',
      'failed',
      'duplicate',
      'cooldown',
    ]).toContain(status.body.data.state);
    expect(status.body.data.queueState).toBeTruthy();

    const metrics = await request(app.getHttpServer())
      .get('/v1/attendance/queue-metrics')
      .expect(200);
    expect(metrics.body.data.queue).toBe(ATTENDANCE_CHECK_IN_QUEUE);
    expect(typeof metrics.body.data.depth).toBe('number');
    expect(metrics.body.data.sloP95DecisionMs).toBeGreaterThan(0);
  }, 30_000);

  it('stays responsive under concurrent check-ins while jobs queue', async () => {
    const n = 20;
    const prefix = `e2e-burst-${Date.now()}`;
    const posts = Array.from({ length: n }, (_, i) =>
      request(app.getHttpServer())
        .post('/v1/attendance/check-ins')
        .set('Idempotency-Key', `${prefix}-${i}`)
        .send({
          imageBase64: TINY_PNG,
          venueId: 'ven_burst',
          shiftId: 'shf_burst',
          direction: 'in',
          candidateWorkerIds: ['wrk_burst'],
        }),
    );

    const started = Date.now();
    const results = await Promise.all(posts);
    const enqueueMs = Date.now() - started;

    for (const res of results) {
      expect(res.status).toBe(202);
      expect(res.body.data.jobId).toBeTruthy();
    }
    expect(enqueueMs).toBeLessThan(5000);

    const healthStarted = Date.now();
    const health = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200);
    const healthMs = Date.now() - healthStarted;

    expect(health.body.success).toBe(true);
    expect(healthMs).toBeLessThan(500);
  }, 30_000);
});
