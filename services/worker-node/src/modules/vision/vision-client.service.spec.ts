import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisionClientService } from './vision-client.service.js';

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

    const config = {
      getOrThrow: (key: string) => {
        if (key === 'VISION_ENGINE_URL') return 'http://vision.test:8000';
        throw new Error(key);
      },
    } as unknown as ConfigService;

    const client = new VisionClientService(config);
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
    const config = {
      getOrThrow: () => 'http://vision.test:8000',
    } as unknown as ConfigService;
    const client = new VisionClientService(config);
    await expect(
      client.match({
        imageBase64: 'abc',
        venueId: 'ven_1',
        shiftId: 'shf_1',
      }),
    ).rejects.toThrow(/503/);
  });
});
