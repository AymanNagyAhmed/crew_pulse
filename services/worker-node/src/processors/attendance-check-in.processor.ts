import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AttendanceStore } from '../modules/attendance/attendance.store.js';
import { CaptureHistoryStore } from '../modules/attendance/capture-history.store.js';
import { resolveVenueCooldownSeconds } from '../modules/attendance/venue-cooldown.js';
import { IdempotencyService } from '../modules/queues/idempotency.service.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../modules/queues/queue.constants.js';
import {
  CircuitOpenError,
  VisionClientService,
} from '../modules/vision/vision-client.service.js';
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
    private readonly captureHistory: CaptureHistoryStore,
  ) {
    super();
  }

  async process(
    job: Job<AttendanceCheckInJob>,
  ): Promise<AttendanceCheckInResult> {
    const payload = job.data;
    const globalCooldown =
      this.config.get<number>('ATTENDANCE_COOLDOWN_SECONDS') ?? 60;
    const cooldown = resolveVenueCooldownSeconds(
      payload.venueId,
      globalCooldown,
      this.config.get<string>('ATTENDANCE_COOLDOWN_BY_VENUE'),
    );

    const claimed = await this.idempotency.tryClaim(
      ATTENDANCE_CHECK_IN_QUEUE,
      payload.idempotencyKey,
      Math.max(cooldown * 2, 60),
    );
    if (!claimed) {
      return this.duplicateResult(payload.idempotencyKey);
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
      const circuitOpen = err instanceof CircuitOpenError;
      this.logger.warn(
        `check-in vision failed key=${payload.idempotencyKey}: ${message}`,
      );

      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      if (isFinalAttempt) {
        this.captureHistory.record({
          idempotencyKey: payload.idempotencyKey,
          venueId: payload.venueId,
          shiftId: payload.shiftId,
          direction: payload.direction,
          outcome: circuitOpen ? 'circuit_open' : 'vision_error',
        });
        // Only scrub when we will not retry — retries still need the frame.
        await this.scrubInFlightFrame(job);
      }

      // Release so BullMQ backoff retries can re-claim after transient failure.
      await this.idempotency.release(
        ATTENDANCE_CHECK_IN_QUEUE,
        payload.idempotencyKey,
      );
      throw err instanceof Error ? err : new Error(message);
    }

    await this.scrubInFlightFrame(job);

    // C12: high-risk / injection-suspect path — capture for review, never payroll.
    if (payload.forceReview) {
      this.captureHistory.record({
        idempotencyKey: payload.idempotencyKey,
        venueId: payload.venueId,
        shiftId: payload.shiftId,
        direction: payload.direction,
        outcome: 'needs_review',
        bestScore: match.best_score,
        ...(match.candidates[0]
          ? { workerId: match.candidates[0].worker_id }
          : {}),
      });
      return {
        status: 'needs_review',
        decision: 'needs_review',
        idempotencyKey: payload.idempotencyKey,
        bestScore: match.best_score,
        ...(match.candidates[0]
          ? { workerId: match.candidates[0].worker_id }
          : {}),
        message: 'high_risk_capture_requires_human_review',
      };
    }

    if (match.decision !== 'matched' || !match.candidates[0]) {
      this.captureHistory.record({
        idempotencyKey: payload.idempotencyKey,
        venueId: payload.venueId,
        shiftId: payload.shiftId,
        direction: payload.direction,
        outcome: match.decision,
        bestScore: match.best_score,
      });
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
      ...(payload.stationId ? { stationId: payload.stationId } : {}),
    };

    const result = this.attendanceStore.persist(persistPayload, cooldown);
    if (result.status === 'cooldown') {
      this.captureHistory.record({
        idempotencyKey: payload.idempotencyKey,
        venueId: payload.venueId,
        shiftId: payload.shiftId,
        direction: payload.direction,
        outcome: 'cooldown',
        workerId,
        bestScore: match.best_score,
        attendanceId: result.record.id,
      });
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
      this.captureHistory.record({
        idempotencyKey: payload.idempotencyKey,
        venueId: payload.venueId,
        shiftId: payload.shiftId,
        direction: payload.direction,
        outcome: 'duplicate',
        workerId,
        bestScore: match.best_score,
        attendanceId: result.record.id,
      });
      return {
        status: 'duplicate',
        decision: 'matched',
        idempotencyKey: payload.idempotencyKey,
        workerId,
        attendanceId: result.record.id,
        bestScore: match.best_score,
      };
    }

    this.captureHistory.record({
      idempotencyKey: payload.idempotencyKey,
      venueId: payload.venueId,
      shiftId: payload.shiftId,
      direction: payload.direction,
      outcome: 'matched',
      workerId,
      bestScore: match.best_score,
      attendanceId: result.record.id,
    });

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

  private duplicateResult(idempotencyKey: string): AttendanceCheckInResult {
    const existing = this.attendanceStore.findByIdempotency(idempotencyKey);
    if (existing) {
      return {
        status: 'duplicate',
        decision: 'matched',
        idempotencyKey,
        workerId: existing.workerId,
        attendanceId: existing.id,
        bestScore: existing.score,
      };
    }
    const capture = this.captureHistory.findByIdempotency(idempotencyKey);
    if (capture) {
      const status =
        capture.outcome === 'circuit_open' ? 'vision_error' : capture.outcome;
      return {
        status: status as AttendanceCheckInResult['status'],
        ...(capture.outcome === 'matched' ||
        capture.outcome === 'needs_review' ||
        capture.outcome === 'no_match' ||
        capture.outcome === 'assisted_fallback'
          ? { decision: capture.outcome }
          : {}),
        idempotencyKey,
        ...(capture.workerId !== undefined
          ? { workerId: capture.workerId }
          : {}),
        ...(capture.attendanceId !== undefined
          ? { attendanceId: capture.attendanceId }
          : {}),
        ...(capture.bestScore !== undefined
          ? { bestScore: capture.bestScore }
          : {}),
      };
    }
    return { status: 'duplicate', idempotencyKey };
  }

  /** Clear imageBase64 so completed job records are not long-lived face stores. */
  private async scrubInFlightFrame(
    job: Job<AttendanceCheckInJob>,
  ): Promise<void> {
    try {
      const data = job.data;
      if (!data.imageBase64) {
        return;
      }
      await job.updateData({
        ...data,
        imageBase64: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'scrub failed';
      this.logger.warn(
        `failed to scrub in-flight frame key=${job.data.idempotencyKey}: ${message}`,
      );
    }
  }
}
