import { describe, expect, it } from 'vitest';
import { mapCheckInUxState } from './check-in-job-state.js';

describe('mapCheckInUxState', () => {
  it('maps in-flight BullMQ states to queued', () => {
    expect(mapCheckInUxState('waiting')).toBe('queued');
    expect(mapCheckInUxState('active')).toBe('queued');
    expect(mapCheckInUxState('delayed')).toBe('queued');
  });

  it('maps completed decisions to UX states', () => {
    expect(
      mapCheckInUxState('completed', {
        status: 'matched',
        decision: 'matched',
        idempotencyKey: 'k',
      }),
    ).toBe('matched');
    expect(
      mapCheckInUxState('completed', {
        status: 'needs_review',
        decision: 'needs_review',
        idempotencyKey: 'k',
      }),
    ).toBe('needs_review');
    expect(
      mapCheckInUxState('completed', {
        status: 'vision_error',
        idempotencyKey: 'k',
        message: 'down',
      }),
    ).toBe('failed');
  });

  it('maps BullMQ failed to failed', () => {
    expect(mapCheckInUxState('failed')).toBe('failed');
  });
});
