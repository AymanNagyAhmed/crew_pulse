import { Injectable } from '@nestjs/common';
import { IdempotencyService } from '../queues/idempotency.service.js';
import {
  ATTENDANCE_CHECK_IN_QUEUE,
  ATTENDANCE_LOG_QUEUE,
  WEBHOOK_QUEUE,
} from '../queues/queue.constants.js';

@Injectable()
export class HealthService {
  constructor(private readonly idempotency: IdempotencyService) {}

  async getStatus() {
    const pong = await this.idempotency.ping();
    return {
      service: 'worker-node',
      status: 'ok' as const,
      redis: pong === 'PONG' ? 'ok' : 'degraded',
      queues: [
        ATTENDANCE_LOG_QUEUE,
        ATTENDANCE_CHECK_IN_QUEUE,
        WEBHOOK_QUEUE,
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
