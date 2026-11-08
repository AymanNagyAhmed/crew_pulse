import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VisionClientService } from '../vision/vision-client.service.js';
import { IdempotencyService } from '../queues/idempotency.service.js';
import { QueueMetricsService } from '../queues/queue-metrics.service.js';
import {
  ATTENDANCE_CHECK_IN_QUEUE,
  ATTENDANCE_LOG_QUEUE,
  WEBHOOK_QUEUE,
} from '../queues/queue.constants.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly queueMetrics: QueueMetricsService,
    private readonly vision: VisionClientService,
    private readonly config: ConfigService,
  ) {}

  async getStatus() {
    const pong = await this.idempotency.ping();
    const queues = await this.queueMetrics.snapshot();
    const checkIn = queues.find((q) => q.name === ATTENDANCE_CHECK_IN_QUEUE);
    const warnDepth =
      this.config.get<number>('CHECK_IN_QUEUE_WARN_DEPTH') ?? 50;
    const maxDepth =
      this.config.get<number>('CHECK_IN_QUEUE_MAX_WAITING') ?? 200;
    const depth = checkIn?.depth ?? 0;

    return {
      service: 'worker-node',
      status: 'ok' as const,
      redis: pong === 'PONG' ? 'ok' : 'degraded',
      queues: [ATTENDANCE_LOG_QUEUE, ATTENDANCE_CHECK_IN_QUEUE, WEBHOOK_QUEUE],
      queueMetrics: queues,
      backpressure: {
        checkInDepth: depth,
        warnDepth,
        maxDepth,
        alertBeforeShift:
          depth >= warnDepth
            ? 'queue_depth_high'
            : ('ok' as 'ok' | 'queue_depth_high'),
      },
      visionCircuit: this.vision.circuitSnapshot(),
      timestamp: new Date().toISOString(),
    };
  }
}
