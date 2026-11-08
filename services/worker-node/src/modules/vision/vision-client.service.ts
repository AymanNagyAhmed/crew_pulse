import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from './circuit-breaker.js';

export type VisionMatchRequest = {
  imageBase64: string;
  venueId: string;
  shiftId: string;
  candidateWorkerIds?: string[];
  topK?: number;
};

export type VisionMatchResponse = {
  decision: 'matched' | 'no_match' | 'needs_review' | 'assisted_fallback';
  best_score: number;
  threshold: number;
  candidates: { worker_id: string; score: number }[];
  stub?: boolean;
};

@Injectable()
export class VisionClientService {
  private readonly logger = new Logger(VisionClientService.name);
  private readonly breaker: CircuitBreaker;

  constructor(private readonly config: ConfigService) {
    const threshold =
      this.config.get<number>('VISION_CIRCUIT_FAILURE_THRESHOLD') ?? 5;
    const openMs = this.config.get<number>('VISION_CIRCUIT_OPEN_MS') ?? 30_000;
    this.breaker = new CircuitBreaker(threshold, openMs);
  }

  circuitSnapshot(): { state: string; failures: number; openMs: number } {
    return this.breaker.snapshot();
  }

  async match(input: VisionMatchRequest): Promise<VisionMatchResponse> {
    this.breaker.assertAllow();

    const base = this.config
      .getOrThrow<string>('VISION_ENGINE_URL')
      .replace(/\/$/, '');
    const url = `${base}/v1/match`;
    const body = {
      image_base64: input.imageBase64,
      venue_id: input.venueId,
      shift_id: input.shiftId,
      top_k: input.topK ?? 5,
      ...(input.candidateWorkerIds?.length
        ? { candidate_worker_ids: input.candidateWorkerIds }
        : {}),
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.breaker.recordFailure();
      const message = err instanceof Error ? err.message : 'network error';
      this.logger.warn(`vision match network error: ${message}`);
      throw new Error(`vision match network error: ${message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`vision match HTTP ${res.status}: ${text.slice(0, 200)}`);
      // 429 → open immediately so retries do not stampede the GPU / rate limit.
      this.breaker.recordFailure({ openImmediately: res.status === 429 });
      throw new Error(`vision match failed with status ${res.status}`);
    }

    const data = (await res.json()) as VisionMatchResponse;
    if (
      data.decision !== 'matched' &&
      data.decision !== 'no_match' &&
      data.decision !== 'needs_review' &&
      data.decision !== 'assisted_fallback'
    ) {
      this.breaker.recordFailure();
      throw new Error('vision match returned invalid decision');
    }

    this.breaker.recordSuccess();
    return data;
  }
}

export { CircuitOpenError };
