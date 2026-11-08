import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CircuitOpenError } from './circuit-breaker.js';
import { VisionClientService } from './vision-client.service.js';

function configWith(overrides?: Record<string, number | string>): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === 'VISION_ENGINE_URL') return 'http://vision.test:8000';
      throw new Error(key);
    },
    get: (key: string) => {
      if (key === 'VISION_CIRCUIT_FAILURE_THRESHOLD') {
        return overrides?.VISION_CIRCUIT_FAILURE_THRESHOLD ?? 2;
      }
      if (key === 'VISION_CIRCUIT_OPEN_MS') {
        return overrides?.VISION_CIRCUIT_OPEN_MS ?? 30_000;
      }
      return undefined;
    },
  } as unknown as ConfigService;
}

describe('VisionClientService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs /v1/match and returns decision', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        decision: 'matched',
        best_score: 0.91,
        threshold: 0.75,
        candidates: [{ worker_id: 'wrk_1', score: 0.91 }],
        stub: true,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new VisionClientService(configWith());
    const result = await client.match({
      imageBase64: 'abc',
      venueId: 'ven_1',
      shiftId: 'shf_1',
      candidateWorkerIds: ['wrk_1'],
    });

    expect(result.decision).toBe('matched');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://vision.test:8000/v1/match',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-OK HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'down',
      }),
    );
    const client = new VisionClientService(configWith());
    await expect(
      client.match({
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
      }),
    ).rejects.toThrow(/503/);
  });

  it('opens circuit on 429 and blocks subsequent calls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      }),
    );
    const client = new VisionClientService(configWith({ VISION_CIRCUIT_FAILURE_THRESHOLD: 10 }));
    await expect(
      client.match({
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
      }),
    ).rejects.toThrow(/429/);

    await expect(
      client.match({
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
      }),
    ).rejects.toThrow(CircuitOpenError);
    expect(client.circuitSnapshot().state).toBe('open');
  });
});
