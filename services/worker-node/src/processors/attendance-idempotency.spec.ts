import { describe, expect, it } from 'vitest';
import { buildAttendanceIdempotencyKey } from './attendance-idempotency.js';

describe('buildAttendanceIdempotencyKey', () => {
  it('buckets timestamps within the same minute', () => {
    const a = buildAttendanceIdempotencyKey({
      workerId: 'w1',
      venueId: 'v1',
      shiftId: 's1',
      direction: 'in',
      matchedAt: '2026-11-03T18:00:10.000Z',
      bucketSeconds: 60,
    });
    const b = buildAttendanceIdempotencyKey({
      workerId: 'w1',
      venueId: 'v1',
      shiftId: 's1',
      direction: 'in',
      matchedAt: '2026-11-03T18:00:50.000Z',
      bucketSeconds: 60,
    });
    expect(a).toBe(b);
  });

  it('changes when direction differs', () => {
    const inn = buildAttendanceIdempotencyKey({
      workerId: 'w1',
      venueId: 'v1',
      shiftId: 's1',
      direction: 'in',
      matchedAt: '2026-11-03T18:00:00.000Z',
    });
    const out = buildAttendanceIdempotencyKey({
      workerId: 'w1',
      venueId: 'v1',
      shiftId: 's1',
      direction: 'out',
      matchedAt: '2026-11-03T18:00:00.000Z',
    });
    expect(inn).not.toBe(out);
  });
});
