import { describe, expect, it } from 'vitest';
import type { AttendanceLogJob } from '../../processors/attendance-log.job.js';
import { AttendanceStore } from './attendance.store.js';

function job(overrides: Partial<AttendanceLogJob> = {}): AttendanceLogJob {
  return {
    idempotencyKey: 'key-1',
    workerId: 'worker_1',
    venueId: 'venue_1',
    shiftId: 'shift_1',
    direction: 'in',
    matchedAt: '2026-11-03T18:00:00.000Z',
    score: 0.9,
    ...overrides,
  };
}

describe('AttendanceStore', () => {
  it('writes a verified attendance row once', () => {
    const store = new AttendanceStore();
    const first = store.persist(job(), 60);
    expect(first.status).toBe('written');
    expect(store.count()).toBe(1);
  });

  it('does not duplicate on same idempotency key', () => {
    const store = new AttendanceStore();
    store.persist(job(), 60);
    const second = store.persist(job(), 60);
    expect(second.status).toBe('duplicate');
    expect(store.count()).toBe(1);
  });

  it('suppresses punches inside the cooldown window', () => {
    const store = new AttendanceStore();
    store.persist(job({ idempotencyKey: 'a' }), 60);
    const cooled = store.persist(
      job({
        idempotencyKey: 'b',
        matchedAt: '2026-11-03T18:00:30.000Z',
      }),
      60,
    );
    expect(cooled.status).toBe('cooldown');
    expect(store.count()).toBe(1);
  });

  it('allows a punch after the cooldown window', () => {
    const store = new AttendanceStore();
    store.persist(job({ idempotencyKey: 'a' }), 60);
    const later = store.persist(
      job({
        idempotencyKey: 'c',
        matchedAt: '2026-11-03T18:02:00.000Z',
      }),
      60,
    );
    expect(later.status).toBe('written');
    expect(store.count()).toBe(2);
  });
});
