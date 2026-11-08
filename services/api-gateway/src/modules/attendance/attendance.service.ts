import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../queues/queue.constants.js';
import {
  type AssistedAttendanceRecord,
  AssistedAttendanceStore,
} from './assisted-attendance.store.js';
import {
  parseQrTokens,
  verifyAssistedCredential,
} from './assisted-credentials.js';
import type {
  AttendanceCheckInJob,
  AttendanceCheckInResult,
} from './attendance-check-in.job.js';
import type { AssistedCheckInDto } from './dto/assisted-check-in.dto.js';
import type { CreateCheckInDto } from './dto/create-check-in.dto.js';

export type EnqueueCheckInResult = {
  jobId: string;
  idempotencyKey: string;
  queue: typeof ATTENDANCE_CHECK_IN_QUEUE;
  state: 'queued';
};

export type CheckInJobStatus = {
  jobId: string;
  state: string;
  idempotencyKey?: string;
  result?: AttendanceCheckInResult;
  failedReason?: string;
};

export type AssistedCheckInResult = {
  attendanceId: string;
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  method: 'supervisor_pin' | 'qr';
  reason?: string;
  idempotencyKey: string;
  punchedAt: string;
  state: 'recorded';
};

@Injectable()
export class AttendanceService {
  constructor(
    @InjectQueue(ATTENDANCE_CHECK_IN_QUEUE)
    private readonly checkInQueue: Queue<
      AttendanceCheckInJob,
      AttendanceCheckInResult
    >,
    private readonly assistedStore: AssistedAttendanceStore,
    private readonly config: ConfigService,
  ) {}

  list() {
    const assisted = this.assistedStore.list();
    return { items: assisted as unknown[], total: assisted.length };
  }

  async enqueueCheckIn(
    dto: CreateCheckInDto,
    idempotencyKeyHeader?: string,
  ): Promise<EnqueueCheckInResult> {
    const idempotencyKey =
      idempotencyKeyHeader?.trim() || `chk_${randomUUID().replaceAll('-', '')}`;

    const existing = await this.checkInQueue.getJob(idempotencyKey);
    if (existing) {
      return {
        jobId: String(existing.id),
        idempotencyKey,
        queue: ATTENDANCE_CHECK_IN_QUEUE,
        state: 'queued',
      };
    }

    const payload: AttendanceCheckInJob = {
      idempotencyKey,
      imageBase64: dto.imageBase64,
      venueId: dto.venueId,
      shiftId: dto.shiftId,
      direction: dto.direction,
      ...(dto.candidateWorkerIds?.length
        ? { candidateWorkerIds: dto.candidateWorkerIds }
        : {}),
    };

    const job = await this.checkInQueue.add('check-in', payload, {
      jobId: idempotencyKey,
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'exponential', delay: 500 },
    });

    return {
      jobId: String(job.id),
      idempotencyKey,
      queue: ATTENDANCE_CHECK_IN_QUEUE,
      state: 'queued',
    };
  }

  async getJobStatus(jobId: string): Promise<CheckInJobStatus> {
    const job = await this.checkInQueue.getJob(jobId);
    if (!job) {
      throw new DomainException(
        'CHECK_IN_JOB_NOT_FOUND',
        `No check-in job with id ${jobId}`,
        404,
      );
    }

    const state = await job.getState();
    return {
      jobId: String(job.id),
      state,
      idempotencyKey: job.data.idempotencyKey,
      result: job.returnvalue,
      failedReason: job.failedReason || undefined,
    };
  }

  /**
   * Non-biometric punch when vision returns assisted_fallback (heavy PPE/mask).
   * Validates supervisor PIN or station QR; does not call vision-engine.
   */
  recordAssistedCheckIn(
    dto: AssistedCheckInDto,
    idempotencyKeyHeader?: string,
  ): AssistedCheckInResult {
    const supervisorPin =
      this.config.get<string>('ASSISTED_SUPERVISOR_PIN') ??
      'dev-pin-change-me';
    const qrTokens = parseQrTokens(
      this.config.get<string>('ASSISTED_QR_TOKENS') ?? 'dev-qr-change-me',
    );

    const ok = verifyAssistedCredential({
      method: dto.method,
      credential: dto.credential,
      supervisorPin,
      qrTokens,
    });
    if (!ok) {
      throw new DomainException(
        'ASSISTED_CREDENTIAL_INVALID',
        'Supervisor PIN or QR token was rejected',
        401,
        [{ field: 'credential', issue: 'invalid for assisted check-in' }],
      );
    }

    const idempotencyKey =
      idempotencyKeyHeader?.trim() ||
      `assist_${randomUUID().replaceAll('-', '')}`;

    const { record } = this.assistedStore.write({
      workerId: dto.workerId,
      venueId: dto.venueId,
      shiftId: dto.shiftId,
      direction: dto.direction,
      method: dto.method,
      ...(dto.reason ? { reason: dto.reason } : {}),
      idempotencyKey,
    } satisfies Omit<
      AssistedAttendanceRecord,
      'id' | 'createdAt' | 'punchedAt'
    >);

    return {
      attendanceId: record.id,
      workerId: record.workerId,
      venueId: record.venueId,
      shiftId: record.shiftId,
      direction: record.direction,
      method: record.method,
      ...(record.reason ? { reason: record.reason } : {}),
      idempotencyKey: record.idempotencyKey,
      punchedAt: record.punchedAt,
      state: 'recorded',
    };
  }
}
