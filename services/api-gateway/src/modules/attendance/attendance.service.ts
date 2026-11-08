import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { ATTENDANCE_CHECK_IN_QUEUE } from '../queues/queue.constants.js';
import {
  type AttendanceAuditRecord,
  AttendanceAuditStore,
} from './attendance-audit.store.js';
import {
  type AssistedAttendanceRecord,
  AssistedAttendanceStore,
} from './assisted-attendance.store.js';
import {
  parseTokenList,
  verifyAssistedCredential,
} from './assisted-credentials.js';
import type {
  AttendanceCheckInJob,
  AttendanceCheckInResult,
} from './attendance-check-in.job.js';
import {
  type CheckInUxState,
  mapCheckInUxState,
} from './check-in-job-state.js';
import type { AssistedCheckInDto } from './dto/assisted-check-in.dto.js';
import type { CreateCheckInDto } from './dto/create-check-in.dto.js';
import type { CreateOverrideDto } from './dto/create-override.dto.js';
import {
  assertStationBinding,
  parseStationVenueMap,
} from './station-binding.js';

export type EnqueueCheckInResult = {
  jobId: string;
  idempotencyKey: string;
  queue: typeof ATTENDANCE_CHECK_IN_QUEUE;
  state: 'queued';
};

export type CheckInJobStatus = {
  jobId: string;
  /** Stable UX state for door clients (C9). */
  state: CheckInUxState;
  /** Raw BullMQ state for operators. */
  queueState: string;
  idempotencyKey?: string;
  result?: AttendanceCheckInResult;
  failedReason?: string;
};

export type CheckInQueueMetrics = {
  queue: typeof ATTENDANCE_CHECK_IN_QUEUE;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  depth: number;
  maxWaiting: number;
  warnDepth: number;
  backpressure: 'ok' | 'warn' | 'rejecting';
  sloP95DecisionMs: number;
};

export type AssistedCheckInResult = {
  attendanceId: string;
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  method: 'supervisor_pin' | 'qr' | 'badge';
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
    private readonly auditStore: AttendanceAuditStore,
    private readonly config: ConfigService,
  ) {}

  list() {
    const assisted = this.assistedStore.list();
    return { items: assisted as unknown[], total: assisted.length };
  }

  listAudit() {
    const items = this.auditStore.list();
    return { items, total: items.length };
  }

  /**
   * Supervisor override — immutable audit only; does not write payroll attendance (C11).
   */
  recordOverride(dto: CreateOverrideDto): {
    auditId: string;
    kind: 'override';
    payrollWritten: false;
    createdAt: string;
  } {
    const record = this.auditStore.append({
      kind: 'override',
      venueId: dto.venueId,
      actorId: dto.actorId,
      reason: dto.reason,
      ...(dto.shiftId ? { shiftId: dto.shiftId } : {}),
      ...(dto.workerId ? { workerId: dto.workerId } : {}),
      ...(dto.direction ? { direction: dto.direction } : {}),
      ...(dto.relatedId ? { relatedId: dto.relatedId } : {}),
      ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}),
    });
    return {
      auditId: record.id,
      kind: 'override',
      payrollWritten: false,
      createdAt: record.createdAt,
    };
  }

  recordLowConfidenceAccept(input: {
    venueId: string;
    shiftId: string;
    workerId: string;
    actorId: string;
    reason: string;
    confidence: number;
    relatedId?: string;
  }): AttendanceAuditRecord {
    return this.auditStore.append({
      kind: 'low_confidence_accept',
      venueId: input.venueId,
      shiftId: input.shiftId,
      workerId: input.workerId,
      actorId: input.actorId,
      reason: input.reason,
      confidence: input.confidence,
      ...(input.relatedId ? { relatedId: input.relatedId } : {}),
    });
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

    this.assertStationOk(dto);
    await this.assertQueueAcceptsWork();

    const payload: AttendanceCheckInJob = {
      idempotencyKey,
      imageBase64: dto.imageBase64,
      venueId: dto.venueId,
      shiftId: dto.shiftId,
      direction: dto.direction,
      ...(dto.candidateWorkerIds?.length
        ? { candidateWorkerIds: dto.candidateWorkerIds }
        : {}),
      ...(dto.stationId ? { stationId: dto.stationId } : {}),
    };

    // Short-lived in-flight frames (C7): age-cap completed/failed jobs so
    // imageBase64 does not linger in Redis beyond the decision window.
    const job = await this.checkInQueue.add('check-in', payload, {
      jobId: idempotencyKey,
      removeOnComplete: { age: 120, count: 100 },
      removeOnFail: { age: 300, count: 50 },
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

    const queueState = await job.getState();
    const result = job.returnvalue;
    return {
      jobId: String(job.id),
      state: mapCheckInUxState(queueState, result),
      queueState,
      idempotencyKey: job.data.idempotencyKey,
      result,
      failedReason: job.failedReason || undefined,
    };
  }

  async getQueueMetrics(): Promise<CheckInQueueMetrics> {
    const counts = await this.checkInQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );
    const waiting = counts.waiting ?? 0;
    const delayed = counts.delayed ?? 0;
    const depth = waiting + delayed;
    const maxWaiting =
      this.config.get<number>('CHECK_IN_QUEUE_MAX_WAITING') ?? 200;
    const warnDepth =
      this.config.get<number>('CHECK_IN_QUEUE_WARN_DEPTH') ?? 50;
    const sloP95DecisionMs =
      this.config.get<number>('CHECK_IN_DECISION_SLO_P95_MS') ?? 3000;

    let backpressure: CheckInQueueMetrics['backpressure'] = 'ok';
    if (depth >= maxWaiting) {
      backpressure = 'rejecting';
    } else if (depth >= warnDepth) {
      backpressure = 'warn';
    }

    return {
      queue: ATTENDANCE_CHECK_IN_QUEUE,
      waiting,
      active: counts.active ?? 0,
      delayed,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      depth,
      maxWaiting,
      warnDepth,
      backpressure,
      sloP95DecisionMs,
    };
  }

  /**
   * Non-biometric punch (PIN / QR / badge) — PPE fallback and privacy opt-out.
   * Does not call vision-engine or touch embeddings.
   */
  recordAssistedCheckIn(
    dto: AssistedCheckInDto,
    idempotencyKeyHeader?: string,
  ): AssistedCheckInResult {
    const supervisorPin =
      this.config.get<string>('ASSISTED_SUPERVISOR_PIN') ??
      'dev-pin-change-me';
    const qrTokens = parseTokenList(
      this.config.get<string>('ASSISTED_QR_TOKENS') ?? 'dev-qr-change-me',
    );
    const badgeTokens = parseTokenList(
      this.config.get<string>('ASSISTED_BADGE_TOKENS') ?? 'dev-badge-change-me',
    );

    const ok = verifyAssistedCredential({
      method: dto.method,
      credential: dto.credential,
      supervisorPin,
      qrTokens,
      badgeTokens,
    });
    if (!ok) {
      throw new DomainException(
        'ASSISTED_CREDENTIAL_INVALID',
        'Supervisor PIN, QR, or badge credential was rejected',
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

  private assertStationOk(dto: CreateCheckInDto): void {
    const requireStation =
      (this.config.get<string>('ATTENDANCE_REQUIRE_STATION') ?? 'false') ===
      'true';
    const stationVenues = parseStationVenueMap(
      this.config.get<string>('ATTENDANCE_STATION_VENUES'),
    );
    const geofenceRaw = this.config.get<string>('ATTENDANCE_VENUE_GEOFENCE');
    let geofence: { lat: number; lng: number; radiusMeters: number } | undefined;
    if (geofenceRaw?.trim()) {
      // venueId:lat:lng:radiusMeters — only apply when venue matches
      for (const part of geofenceRaw.split(';')) {
        const [vid, lat, lng, radius] = part.split(':').map((s) => s.trim());
        if (vid === dto.venueId) {
          geofence = {
            lat: Number(lat),
            lng: Number(lng),
            radiusMeters: Number(radius),
          };
          break;
        }
      }
    }

    const bound = assertStationBinding({
      stationId: dto.stationId,
      venueId: dto.venueId,
      requireStation,
      stationVenues,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ...(geofence ? { geofence } : {}),
    });
    if (!bound.ok) {
      this.auditStore.append({
        kind: 'station_reject',
        venueId: dto.venueId,
        shiftId: dto.shiftId,
        actorId: dto.stationId ?? 'unknown_station',
        reason: bound.message,
        metadata: { code: bound.code },
      });
      throw new DomainException(bound.code, bound.message, 403, [
        { field: bound.field, issue: bound.message },
      ]);
    }
  }

  private async assertQueueAcceptsWork(): Promise<void> {
    const maxWaiting =
      this.config.get<number>('CHECK_IN_QUEUE_MAX_WAITING') ?? 200;
    const counts = await this.checkInQueue.getJobCounts('waiting', 'delayed');
    const depth = (counts.waiting ?? 0) + (counts.delayed ?? 0);
    if (depth >= maxWaiting) {
      throw new DomainException(
        'CHECK_IN_QUEUE_BACKPRESSURE',
        `Check-in queue depth ${depth} exceeds limit ${maxWaiting}; try again shortly or use assisted check-in`,
        503,
        [
          {
            field: 'queue',
            issue: `depth=${depth} maxWaiting=${maxWaiting}`,
          },
        ],
      );
    }
  }
}
