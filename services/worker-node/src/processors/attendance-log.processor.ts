import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import { ATTENDANCE_LOG_QUEUE } from '../modules/queues/queue.constants.js';
import type { AttendanceLogJob } from './attendance-log.job.js';

export type AttendanceProcessResult = {
  status: 'written' | 'duplicate';
  idempotencyKey: string;
};

@Processor(ATTENDANCE_LOG_QUEUE)
export class AttendanceLogProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceLogProcessor.name);
  /** In-memory store until Postgres persistence lands in 4.2 */
  private readonly rows = new Map<string, AttendanceLogJob>();

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(
    job: Job<AttendanceLogJob>,
  ): Promise<AttendanceProcessResult> {
    const payload = job.data;
    const ttl =
      this.config.get<number>('ATTENDANCE_COOLDOWN_SECONDS') ?? 60;
    const claimed = await this.idempotency.tryClaim(
      ATTENDANCE_LOG_QUEUE,
      payload.idempotencyKey,
      Math.max(ttl * 2, 60),
    );

    if (!claimed) {
      this.logger.debug(`duplicate attendance job ${payload.idempotencyKey}`);
      return { status: 'duplicate', idempotencyKey: payload.idempotencyKey };
    }

    this.rows.set(payload.idempotencyKey, payload);
    this.logger.log(
      `attendance written worker=${payload.workerId} venue=${payload.venueId}`,
    );
    return { status: 'written', idempotencyKey: payload.idempotencyKey };
  }

  /** Test helper — not used in production path */
  getStored(key: string): AttendanceLogJob | undefined {
    return this.rows.get(key);
  }
}
