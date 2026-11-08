import { describe, expect, it, vi } from 'vitest';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { AssistedAttendanceStore } from './assisted-attendance.store.js';
import { AttendanceService } from './attendance.service.js';

describe('AttendanceService', () => {
  it('enqueues check-in and returns job id without awaiting match', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'chk_abc' });
    const queue = {
      add,
      getJob: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, delayed: 0 }),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === 'ASSISTED_SUPERVISOR_PIN'
          ? 'dev-pin-change-me'
          : key === 'ASSISTED_QR_TOKENS'
            ? 'dev-qr-change-me'
            : key === 'CHECK_IN_QUEUE_MAX_WAITING'
              ? 200
              : undefined,
      ),
    };
    const service = new AttendanceService(
      queue as never,
      new AssistedAttendanceStore(),
      config as never,
    );

    const started = Date.now();
    const result = await service.enqueueCheckIn(
      {
        imageBase64: 'a'.repeat(16),
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
        candidateWorkerIds: ['wrk_1'],
      },
      'chk_abc',
    );
    const elapsed = Date.now() - started;

    expect(result.jobId).toBe('chk_abc');
    expect(result.state).toBe('queued');
    expect(elapsed).toBeLessThan(200);
    expect(add).toHaveBeenCalledWith(
      'check-in',
      expect.objectContaining({
        idempotencyKey: 'chk_abc',
        venueId: 'ven_1',
      }),
      expect.objectContaining({ jobId: 'chk_abc' }),
    );
  });

  it('rejects enqueue when queue depth hits backpressure limit', async () => {
    const queue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 200, delayed: 0 }),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === 'CHECK_IN_QUEUE_MAX_WAITING' ? 200 : undefined,
      ),
    };
    const service = new AttendanceService(
      queue as never,
      new AssistedAttendanceStore(),
      config as never,
    );

    await expect(
      service.enqueueCheckIn({
        imageBase64: 'a'.repeat(16),
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
      }),
    ).rejects.toMatchObject({
      code: 'CHECK_IN_QUEUE_BACKPRESSURE',
      statusCode: 503,
    } satisfies Partial<DomainException>);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('maps completed job status to UX state matched', async () => {
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: 'chk_done',
        data: { idempotencyKey: 'chk_done' },
        returnvalue: {
          status: 'matched',
          decision: 'matched',
          idempotencyKey: 'chk_done',
          workerId: 'wrk_1',
          attendanceId: 'att_1',
        },
        failedReason: undefined,
        getState: vi.fn().mockResolvedValue('completed'),
      }),
    };
    const service = new AttendanceService(
      queue as never,
      new AssistedAttendanceStore(),
      { get: vi.fn() } as never,
    );

    const status = await service.getJobStatus('chk_done');
    expect(status.state).toBe('matched');
    expect(status.queueState).toBe('completed');
  });

  it('records assisted check-in with valid supervisor PIN', () => {
    const queue = { add: vi.fn(), getJob: vi.fn() };
    const config = {
      get: vi.fn((key: string) =>
        key === 'ASSISTED_SUPERVISOR_PIN'
          ? 'dev-pin-change-me'
          : key === 'ASSISTED_QR_TOKENS'
            ? 'station-qr-1'
            : undefined,
      ),
    };
    const service = new AttendanceService(
      queue as never,
      new AssistedAttendanceStore(),
      config as never,
    );

    const result = service.recordAssistedCheckIn(
      {
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
        workerId: 'wrk_ppe',
        method: 'supervisor_pin',
        credential: 'dev-pin-change-me',
        reason: 'face_occluded',
      },
      'assist_1',
    );

    expect(result.state).toBe('recorded');
    expect(result.attendanceId).toMatch(/^att_assist_/);
    expect(result.method).toBe('supervisor_pin');
    expect(result.reason).toBe('face_occluded');
  });

  it('rejects invalid assisted credentials', () => {
    const queue = { add: vi.fn(), getJob: vi.fn() };
    const config = {
      get: vi.fn((key: string) =>
        key === 'ASSISTED_SUPERVISOR_PIN' ? 'dev-pin-change-me' : 'dev-qr',
      ),
    };
    const service = new AttendanceService(
      queue as never,
      new AssistedAttendanceStore(),
      config as never,
    );

    expect(() =>
      service.recordAssistedCheckIn({
        venueId: 'ven_1',
        shiftId: 'shf_1',
        direction: 'in',
        workerId: 'wrk_ppe',
        method: 'qr',
        credential: 'wrong-token',
      }),
    ).toThrow(DomainException);
  });
});
