import { describe, expect, it, vi } from 'vitest';
import { AttendanceService } from './attendance.service.js';

describe('AttendanceService', () => {
  it('enqueues check-in and returns job id without awaiting match', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'chk_abc' });
    const queue = { add, getJob: vi.fn().mockResolvedValue(undefined) };
    const service = new AttendanceService(queue as never);

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
});
