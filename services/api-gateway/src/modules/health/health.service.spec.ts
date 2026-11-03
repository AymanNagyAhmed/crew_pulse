import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns ok status payload', () => {
    const service = new HealthService();
    const status = service.getStatus();
    expect(status.service).toBe('api-gateway');
    expect(status.status).toBe('ok');
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
