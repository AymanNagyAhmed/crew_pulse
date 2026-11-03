import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('accepts test defaults', () => {
    const env = validateEnv({ NODE_ENV: 'test' });
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.WORKER_NODE_PORT).toBe(3001);
  });

  it('requires REDIS_URL outside test', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://x' }),
    ).toThrow(/REDIS_URL/);
  });
});
