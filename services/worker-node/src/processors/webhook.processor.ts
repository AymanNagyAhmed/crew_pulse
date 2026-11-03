import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import { WEBHOOK_QUEUE } from '../modules/queues/queue.constants.js';

export type WebhookJob = {
  idempotencyKey: string;
  url: string;
  event: string;
  body: Record<string, unknown>;
};

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly idempotency: IdempotencyService) {
    super();
  }

  async process(job: Job<WebhookJob>): Promise<{ status: string }> {
    const claimed = await this.idempotency.tryClaim(
      WEBHOOK_QUEUE,
      job.data.idempotencyKey,
      3600,
    );
    if (!claimed) {
      return { status: 'duplicate' };
    }
    // Delivery stub — real HTTP outbound in a later step.
    this.logger.log(`webhook queued event=${job.data.event} url=${job.data.url}`);
    return { status: 'accepted' };
  }
}
