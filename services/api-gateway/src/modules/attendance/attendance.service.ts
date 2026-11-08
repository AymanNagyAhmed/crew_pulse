import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../queues/queue.constants.js';
import type {
  AttendanceCheckInJob,
  AttendanceCheckInResult,
} from './attendance-check-in.job.js';
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

@Injectable()
export class AttendanceService {
  constructor(
    @InjectQueue(ATTENDANCE_CHECK_IN_QUEUE)
    private readonly checkInQueue: Queue<
      AttendanceCheckInJob,
      AttendanceCheckInResult
    >,
  ) {}

  list() {
    return { items: [] as unknown[], total: 0 };
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
}
