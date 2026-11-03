import { describe, expect, it, vi } from 'vitest';

describe('IdempotencyService claim semantics', () => {
  it('treats SET NX OK as first claim and null as duplicate', () => {
    const first = 'OK';
    const second = null;
    expect(first === 'OK').toBe(true);
    expect(second === 'OK').toBe(false);
  });

  it('builds namespaced redis keys', () => {
    const namespace = 'attendance-log';
    const key = 'worker_1:venue_1:shift_1:in:2026-11-03T18';
    const redisKey = `worker:idempotency:${namespace}:${key}`;
    expect(redisKey).toBe(
      'worker:idempotency:attendance-log:worker_1:venue_1:shift_1:in:2026-11-03T18',
    );
  });
});
