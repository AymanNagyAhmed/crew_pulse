import { describe, expect, it } from 'vitest';
import { CaptureHistoryStore } from './capture-history.store.js';
import { AttendanceStore } from './attendance.store.js';

describe('CaptureHistoryStore', () => {
  it('records capture metadata without writing verified attendance', () => {
    const captures = new CaptureHistoryStore();
    const attendance = new AttendanceStore();

    const row = captures.record({
      idempotencyKey: 'chk_1',
      venueId: 'ven_1',
      shiftId: 'shf_1',
      direction: 'in',
      outcome: 'needs_review',
      bestScore: 0.72,
    });

    expect(row.id.startsWith('cap_')).toBe(true);
    expect(captures.count()).toBe(1);
    expect(attendance.count()).toBe(0);
    expect(row.attendanceId).toBeUndefined();
  });

  it('is idempotent on the same key', () => {
    const captures = new CaptureHistoryStore();
    const a = captures.record({
      idempotencyKey: 'chk_dup',
      venueId: 'ven_1',
      shiftId: 'shf_1',
      direction: 'in',
      outcome: 'no_match',
    });
    const b = captures.record({
      idempotencyKey: 'chk_dup',
      venueId: 'ven_1',
      shiftId: 'shf_1',
      direction: 'in',
      outcome: 'matched',
    });
    expect(b.id).toBe(a.id);
    expect(b.outcome).toBe('no_match');
    expect(captures.count()).toBe(1);
  });
});
