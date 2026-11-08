import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('opens after consecutive failures and blocks calls', () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(3, 5_000, () => now);

    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('closed');
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');
    expect(() => breaker.assertAllow()).toThrow(CircuitOpenError);
  });

  it('moves to half_open after openMs then closes on success', () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(1, 100, () => now);
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');

    now = 1_200;
    expect(breaker.getState()).toBe('half_open');
    breaker.assertAllow();
    breaker.recordSuccess();
    expect(breaker.getState()).toBe('closed');
  });

  it('opens immediately on demand (e.g. HTTP 429)', () => {
    const breaker = new CircuitBreaker(10, 1_000);
    breaker.recordFailure({ openImmediately: true });
    expect(breaker.getState()).toBe('open');
  });
});
