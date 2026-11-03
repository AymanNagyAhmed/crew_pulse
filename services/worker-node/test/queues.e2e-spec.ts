import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue, QueueEvents } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ATTENDANCE_LOG_QUEUE } from '../src/modules/queues/queue.constants.js';
import type { AttendanceLogJob } from '../src/processors/attendance-log.job.js';

describe('attendance-log queue (e2e)', () => {
  let app: INestApplication;
  let queue: Queue<AttendanceLogJob>;
  let events: QueueEvents;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
    process.env.WORKER_NODE_PORT = '3001';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    queue = app.get<Queue<AttendanceLogJob>>(
      getQueueToken(ATTENDANCE_LOG_QUEUE),
    );
    events = new QueueEvents(ATTENDANCE_LOG_QUEUE, {
      connection: { url: process.env.REDIS_URL },
    });
    await events.waitUntilReady();
  }, 30_000);

  afterAll(async () => {
    await events?.close().catch(() => undefined);
    await queue?.obliterate({ force: true }).catch(() => undefined);
    await app?.close();
  });

  it('processes a job and marks duplicate idempotency as duplicate', async () => {
    const idempotencyKey = `e2e-${Date.now()}`;
    const payload: AttendanceLogJob = {
      idempotencyKey,
      workerId: 'worker_e2e',
      venueId: 'venue_e2e',
      shiftId: 'shift_e2e',
      direction: 'in',
      matchedAt: new Date().toISOString(),
      score: 0.91,
    };

    const first = await queue.add('persist', payload, {
      jobId: `job-${idempotencyKey}-1`,
      removeOnComplete: 100,
    });
    const firstResult = (await first.waitUntilFinished(events, 15_000)) as {
      status: string;
    };
    expect(firstResult.status).toBe('written');

    const second = await queue.add('persist', payload, {
      jobId: `job-${idempotencyKey}-2`,
      removeOnComplete: 100,
    });
    const secondResult = (await second.waitUntilFinished(events, 15_000)) as {
      status: string;
    };
    expect(secondResult.status).toBe('duplicate');
  }, 30_000);
});
