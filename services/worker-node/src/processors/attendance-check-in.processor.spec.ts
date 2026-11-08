import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceStore } from '../modules/attendance/attendance.store.js';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import type { VisionClientService } from '../modules/vision/vision-client.service.js';
import { AttendanceCheckInProcessor } from './attendance-check-in.processor.js';
import type { AttendanceCheckInJob } from './attendance-check-in.job.js';

function makeJob(data: AttendanceCheckInJob) {
  return { data } as never;
}

describe('AttendanceCheckInProcessor', () => {
  it('matches via vision then persists attendance', async () => {
    const idempotency = {
      tryClaim: vi.fn().mockResolvedValue(true),
    } as unknown as IdempotencyService;
    const config = {
      get: () => 60,
    } as unknown as ConfigService;
    const vision = {
      match: vi.fn().mockResolvedValue({
        decision: 'matched',
        best_score: 0.93,
        threshold: 0.75,
        candidates: [{ worker_id: 'wrk_peak', score: 0.93 }],
      }),
    } as unknown as VisionClientService;
    const store = new AttendanceStore();

    const processor = new AttendanceCheckInProcessor(
      idempotency,
      config,
      vision,
      store,
    );
    const result = await processor.process(
      makeJob({
        idempotencyKey: 'chk_1',
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
        candidateWorkerIds: ['wrk_peak'],
      }),
    );

    expect(result.status).toBe('matched');
    expect(result.workerId).toBe('wrk_peak');
    expect(result.attendanceId).toBeTruthy();
    expect(store.count()).toBe(1);
  });

  it('returns no_match without writing attendance', async () => {
    const processor = new AttendanceCheckInProcessor(
      { tryClaim: vi.fn().mockResolvedValue(true) } as unknown as IdempotencyService,
      { get: () => 60 } as unknown as ConfigService,
      {
        match: vi.fn().mockResolvedValue({
          decision: 'no_match',
          best_score: 0.1,
          threshold: 0.75,
          candidates: [],
        }),
      } as unknown as VisionClientService,
      new AttendanceStore(),
    );

    const result = await processor.process(
      makeJob({
        idempotencyKey: 'chk_2',
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
      }),
    );
    expect(result.status).toBe('no_match');
    expect(result.attendanceId).toBeUndefined();
  });
});
