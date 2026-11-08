import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly config: ConfigService) {}

  async match(input: VisionMatchRequest): Promise<VisionMatchResponse> {
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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`vision match HTTP ${res.status}: ${text.slice(0, 200)}`);
      throw new Error(`vision match failed with status ${res.status}`);
    }

    const data = (await res.json()) as VisionMatchResponse;
    if (
      data.decision !== 'matched' &&
      data.decision !== 'no_match' &&
      data.decision !== 'needs_review' &&
      data.decision !== 'assisted_fallback'
    ) {
      throw new Error('vision match returned invalid decision');
    }
    return data;
  }
}
