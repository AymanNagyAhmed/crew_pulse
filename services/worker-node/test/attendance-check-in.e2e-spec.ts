import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue, QueueEvents } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../src/modules/queues/queue.constants.js';
import type {
  AttendanceCheckInJob,
  AttendanceCheckInResult,
} from '../src/processors/attendance-check-in.job.js';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('attendance-check-in queue (e2e)', () => {
  let app: INestApplication;
  let queue: Queue<AttendanceCheckInJob, AttendanceCheckInResult>;
  let events: QueueEvents;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
    process.env.WORKER_NODE_PORT = '3001';
    process.env.VISION_ENGINE_URL =
      process.env.VISION_ENGINE_URL ?? 'http://localhost:8000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    queue = app.get(getQueueToken(ATTENDANCE_CHECK_IN_QUEUE));
    events = new QueueEvents(ATTENDANCE_CHECK_IN_QUEUE, {
      connection: { url: process.env.REDIS_URL },
    });
    await events.waitUntilReady();
  }, 30_000);

  afterAll(async () => {
    await events?.close().catch(() => undefined);
    await queue?.obliterate({ force: true }).catch(() => undefined);
    await app?.close();
  });

  it('runs vision match then returns matched with attendance id', async () => {
    const key = `e2e-match-${Date.now()}`;
    const payload: AttendanceCheckInJob = {
      idempotencyKey: key,
      imageBase64: TINY_PNG,
      venueId: 'ven_e2e',
      shiftId: 'shf_e2e',
      direction: 'in',
      candidateWorkerIds: ['wrk_e2e_001'],
    };

    const job = await queue.add('check-in', payload, {
      jobId: key,
      removeOnComplete: 50,
    });
    const result = (await job.waitUntilFinished(
      events,
      20_000,
    )) as AttendanceCheckInResult;

    expect(result.status).toBe('matched');
    expect(result.workerId).toBeTruthy();
    expect(result.attendanceId).toBeTruthy();
    expect(result.bestScore).toBeGreaterThan(0);
  }, 30_000);
});
