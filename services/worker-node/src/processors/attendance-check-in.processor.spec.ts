import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceStore } from '../modules/attendance/attendance.store.js';
import { CaptureHistoryStore } from '../modules/attendance/capture-history.store.js';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import type { VisionClientService } from '../modules/vision/vision-client.service.js';
import { AttendanceCheckInProcessor } from './attendance-check-in.processor.js';
import type { AttendanceCheckInJob } from './attendance-check-in.job.js';

function makeJob(data: AttendanceCheckInJob, opts?: { attempts?: number }) {
  return {
    data,
    opts: { attempts: opts?.attempts ?? 2 },
    attemptsMade: 0,
    updateData: vi.fn().mockResolvedValue(undefined),
  } as never;
}

describe('AttendanceCheckInProcessor', () => {
  it('matches via vision then persists attendance and capture history separately', async () => {
    const idempotency = {
      tryClaim: vi.fn().mockResolvedValue(true),
      release: vi.fn(),
    } as unknown as IdempotencyService;
    const config = {
      get: (key: string) =>
        key === 'ATTENDANCE_COOLDOWN_SECONDS' ? 60 : undefined,
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
    const captures = new CaptureHistoryStore();

    const processor = new AttendanceCheckInProcessor(
      idempotency,
      config,
      vision,
      store,
      captures,
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
    expect(captures.count()).toBe(1);
    const capture = captures.findByIdempotency('chk_1');
    expect(capture?.id.startsWith('cap_')).toBe(true);
    expect(capture?.attendanceId).toBe(result.attendanceId);
    expect(capture?.id).not.toBe(result.attendanceId);
  });

  it('forceReview skips payroll write and returns needs_review', async () => {
    const store = new AttendanceStore();
    const captures = new CaptureHistoryStore();
    const processor = new AttendanceCheckInProcessor(
      {
        tryClaim: vi.fn().mockResolvedValue(true),
        release: vi.fn(),
      } as unknown as IdempotencyService,
      { get: () => 60 } as unknown as ConfigService,
      {
        match: vi.fn().mockResolvedValue({
          decision: 'matched',
          best_score: 0.95,
          threshold: 0.75,
          candidates: [{ worker_id: 'wrk_risk', score: 0.95 }],
        }),
      } as unknown as VisionClientService,
      store,
      captures,
    );

    const result = await processor.process(
      makeJob({
        idempotencyKey: 'chk_review',
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
        forceReview: true,
        riskTier: 'high',
        captureSource: 'remote_selfie',
      }),
    );
    expect(result.status).toBe('needs_review');
    expect(result.decision).toBe('needs_review');
    expect(store.count()).toBe(0);
    expect(captures.count()).toBe(1);
  });

  it('returns no_match without writing attendance but records capture', async () => {
    const captures = new CaptureHistoryStore();
    const store = new AttendanceStore();
    const processor = new AttendanceCheckInProcessor(
      {
        tryClaim: vi.fn().mockResolvedValue(true),
        release: vi.fn(),
      } as unknown as IdempotencyService,
      {
        get: (key: string) =>
          key === 'ATTENDANCE_COOLDOWN_SECONDS' ? 60 : undefined,
      } as unknown as ConfigService,
      {
        match: vi.fn().mockResolvedValue({
          decision: 'no_match',
          best_score: 0.1,
          threshold: 0.75,
          candidates: [],
        }),
      } as unknown as VisionClientService,
      store,
      captures,
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
    expect(store.count()).toBe(0);
    expect(captures.count()).toBe(1);
  });

  it('does not double-write attendance on duplicate delivery', async () => {
    const store = new AttendanceStore();
    const captures = new CaptureHistoryStore();
    const vision = {
      match: vi.fn().mockResolvedValue({
        decision: 'matched',
        best_score: 0.9,
        threshold: 0.75,
        candidates: [{ worker_id: 'wrk_1', score: 0.9 }],
      }),
    } as unknown as VisionClientService;

    const first = new AttendanceCheckInProcessor(
      {
        tryClaim: vi.fn().mockResolvedValue(true),
        release: vi.fn(),
      } as unknown as IdempotencyService,
      {
        get: (key: string) =>
          key === 'ATTENDANCE_COOLDOWN_SECONDS' ? 60 : undefined,
      } as unknown as ConfigService,
      vision,
      store,
      captures,
    );
    const firstResult = await first.process(
      makeJob({
        idempotencyKey: 'chk_dup',
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
      }),
    );

    const second = new AttendanceCheckInProcessor(
      {
        tryClaim: vi.fn().mockResolvedValue(false),
        release: vi.fn(),
      } as unknown as IdempotencyService,
      {
        get: (key: string) =>
          key === 'ATTENDANCE_COOLDOWN_SECONDS' ? 60 : undefined,
      } as unknown as ConfigService,
      vision,
      store,
      captures,
    );
    const dup = await second.process(
      makeJob({
        idempotencyKey: 'chk_dup',
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
      }),
    );

    expect(firstResult.status).toBe('matched');
    expect(dup.status).toBe('duplicate');
    expect(dup.attendanceId).toBe(firstResult.attendanceId);
    expect(store.count()).toBe(1);
    expect(vision.match).toHaveBeenCalledTimes(1);
  });

  it('releases claim and rethrows on vision failure so BullMQ can retry', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const captures = new CaptureHistoryStore();
    const processor = new AttendanceCheckInProcessor(
      {
        tryClaim: vi.fn().mockResolvedValue(true),
        release,
      } as unknown as IdempotencyService,
      {
        get: (key: string) =>
          key === 'ATTENDANCE_COOLDOWN_SECONDS' ? 60 : undefined,
      } as unknown as ConfigService,
      {
        match: vi.fn().mockRejectedValue(new Error('vision match failed with status 503')),
      } as unknown as VisionClientService,
      new AttendanceStore(),
      captures,
    );

    await expect(
      processor.process(
        makeJob({
          idempotencyKey: 'chk_retry',
          imageBase64: 'abc',
          venueId: 'ven_1',
          shiftId: 'shf_1',
          direction: 'in',
        }),
      ),
    ).rejects.toThrow(/503/);
    expect(release).toHaveBeenCalled();
    // Not final attempt → no durable capture yet
    expect(captures.count()).toBe(0);
  });
});
