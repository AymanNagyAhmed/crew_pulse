import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AttendanceStore } from '../modules/attendance/attendance.store.js';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../modules/queues/queue.constants.js';
import { VisionClientService } from '../modules/vision/vision-client.service.js';
import type {
  AttendanceCheckInJob,
  AttendanceCheckInResult,
} from './attendance-check-in.job.js';
import type { AttendanceLogJob } from './attendance-log.job.js';

@Processor(ATTENDANCE_CHECK_IN_QUEUE, { concurrency: 2 })
export class AttendanceCheckInProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceCheckInProcessor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
    private readonly vision: VisionClientService,
    private readonly attendanceStore: AttendanceStore,
  ) {
    super();
  }

  async process(
    job: Job<AttendanceCheckInJob>,
  ): Promise<AttendanceCheckInResult> {
    const payload = job.data;
    const cooldown =
      this.config.get<number>('ATTENDANCE_COOLDOWN_SECONDS') ?? 60;

    const claimed = await this.idempotency.tryClaim(
      ATTENDANCE_CHECK_IN_QUEUE,
      payload.idempotencyKey,
      Math.max(cooldown * 2, 60),
    );
    if (!claimed) {
      return { status: 'duplicate', idempotencyKey: payload.idempotencyKey };
    }

    let match;
    try {
      match = await this.vision.match({
        imageBase64: payload.imageBase64,
        venueId: payload.venueId,
        shiftId: payload.shiftId,
        candidateWorkerIds: payload.candidateWorkerIds,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'vision error';
      this.logger.warn(
        `check-in vision failed key=${payload.idempotencyKey}: ${message}`,
      );
      return {
        status: 'vision_error',
        idempotencyKey: payload.idempotencyKey,
        message,
      };
    }

    if (match.decision !== 'matched' || !match.candidates[0]) {
      return {
        status: match.decision,
        decision: match.decision,
        idempotencyKey: payload.idempotencyKey,
        bestScore: match.best_score,
      };
    }

    const workerId = match.candidates[0].worker_id;
    const persistPayload: AttendanceLogJob = {
      idempotencyKey: payload.idempotencyKey,
      workerId,
      venueId: payload.venueId,
      shiftId: payload.shiftId,
      direction: payload.direction,
      matchedAt: new Date().toISOString(),
      score: match.best_score,
    };

    const result = this.attendanceStore.persist(persistPayload, cooldown);
    if (result.status === 'cooldown') {
      return {
        status: 'cooldown',
        decision: 'matched',
        idempotencyKey: payload.idempotencyKey,
        workerId,
        attendanceId: result.record.id,
        bestScore: match.best_score,
      };
    }
    if (result.status === 'duplicate') {
      return {
        status: 'duplicate',
        decision: 'matched',
        idempotencyKey: payload.idempotencyKey,
        workerId,
        attendanceId: result.record.id,
        bestScore: match.best_score,
      };
    }

    this.logger.log(
      `check-in matched attendance=${result.record.id} worker=${workerId}`,
    );
    return {
      status: 'matched',
      decision: 'matched',
      idempotencyKey: payload.idempotencyKey,
      workerId,
      attendanceId: result.record.id,
      bestScore: match.best_score,
    };
  }
}
