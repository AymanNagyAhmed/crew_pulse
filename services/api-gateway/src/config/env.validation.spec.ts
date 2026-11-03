import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('requires database/redis/vision urls outside test', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        API_GATEWAY_PORT: '3000',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('allows defaults in test env', () => {
    const env = validateEnv({ NODE_ENV: 'test', API_GATEWAY_PORT: '3000' });
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.VISION_ENGINE_URL).toContain('http://');
  });
});
