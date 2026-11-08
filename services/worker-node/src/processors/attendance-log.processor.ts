import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AttendanceStore } from '../modules/attendance/attendance.store.js';
import { resolveVenueCooldownSeconds } from '../modules/attendance/venue-cooldown.js';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import { ATTENDANCE_LOG_QUEUE } from '../modules/queues/queue.constants.js';
import type { AttendanceLogJob } from './attendance-log.job.js';

export type AttendanceProcessResult = {
  status: 'written' | 'duplicate' | 'cooldown';
  idempotencyKey: string;
  attendanceId?: string;
};

@Processor(ATTENDANCE_LOG_QUEUE)
export class AttendanceLogProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceLogProcessor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
    private readonly attendanceStore: AttendanceStore,
  ) {
    super();
  }

  async process(
    job: Job<AttendanceLogJob>,
  ): Promise<AttendanceProcessResult> {
    const payload = job.data;
    const globalCooldown =
      this.config.get<number>('ATTENDANCE_COOLDOWN_SECONDS') ?? 60;
    const cooldown = resolveVenueCooldownSeconds(
      payload.venueId,
      globalCooldown,
      this.config.get<string>('ATTENDANCE_COOLDOWN_BY_VENUE'),
    );
    const claimed = await this.idempotency.tryClaim(
      ATTENDANCE_LOG_QUEUE,
      payload.idempotencyKey,
      Math.max(cooldown * 2, 60),
    );

    if (!claimed) {
      this.logger.debug(`duplicate attendance job ${payload.idempotencyKey}`);
      return { status: 'duplicate', idempotencyKey: payload.idempotencyKey };
    }

    const result = this.attendanceStore.persist(payload, cooldown);
    if (result.status !== 'written') {
      this.logger.debug(
        `attendance ${result.status} key=${payload.idempotencyKey}`,
      );
      return {
        status: result.status,
        idempotencyKey: payload.idempotencyKey,
        attendanceId: result.record.id,
      };
    }

    this.logger.log(
      `attendance written id=${result.record.id} worker=${payload.workerId}`,
    );
    return {
      status: 'written',
      idempotencyKey: payload.idempotencyKey,
      attendanceId: result.record.id,
    };
  }
}
