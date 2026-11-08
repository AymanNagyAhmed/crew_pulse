import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AttendanceLogJob } from '../../processors/attendance-log.job.js';
import { buildAttendanceIdempotencyKey } from '../../processors/attendance-idempotency.js';
import type { AttendanceRecord } from './attendance-record.js';

export type PersistResult =
  | { status: 'written'; record: AttendanceRecord }
  | { status: 'duplicate'; record: AttendanceRecord }
  | { status: 'cooldown'; record: AttendanceRecord };

/**
 * Verified attendance rows. In-memory for now; swap for Postgres without changing the processor contract.
 * C11: composite bucket key + cooldown suppress duplicate punches.
 */
@Injectable()
export class AttendanceStore {
  private readonly byIdempotency = new Map<string, AttendanceRecord>();
  private readonly byComposite = new Map<string, AttendanceRecord>();
  private readonly chronology: AttendanceRecord[] = [];

  persist(
    job: AttendanceLogJob,
    cooldownSeconds: number,
    bucketSeconds?: number,
  ): PersistResult {
    const existing = this.byIdempotency.get(job.idempotencyKey);
    if (existing) {
      return { status: 'duplicate', record: existing };
    }

    const matchedAtMs = Date.parse(job.matchedAt);
    if (Number.isFinite(matchedAtMs) && cooldownSeconds > 0) {
      const blocked = this.chronology.find((row) => {
        if (
          row.workerId !== job.workerId ||
          row.venueId !== job.venueId ||
          row.shiftId !== job.shiftId ||
          row.direction !== job.direction
        ) {
          return false;
        }
        const prev = Date.parse(row.matchedAt);
        return Math.abs(matchedAtMs - prev) < cooldownSeconds * 1000;
      });
      if (blocked) {
        return { status: 'cooldown', record: blocked };
      }
    }

    const composite = buildAttendanceIdempotencyKey({
      workerId: job.workerId,
      venueId: job.venueId,
      shiftId: job.shiftId,
      direction: job.direction,
      matchedAt: job.matchedAt,
      bucketSeconds: bucketSeconds ?? Math.max(cooldownSeconds, 1),
    });
    const byBucket = this.byComposite.get(composite);
    if (byBucket) {
      return { status: 'duplicate', record: byBucket };
    }

    const record: AttendanceRecord = {
      id: randomUUID(),
      workerId: job.workerId,
      venueId: job.venueId,
      shiftId: job.shiftId,
      direction: job.direction,
      matchedAt: job.matchedAt,
      score: job.score,
      idempotencyKey: job.idempotencyKey,
      createdAt: new Date().toISOString(),
      ...(job.stationId ? { stationId: job.stationId } : {}),
    };
    this.byIdempotency.set(job.idempotencyKey, record);
    this.byComposite.set(composite, record);
    this.chronology.push(record);
    return { status: 'written', record };
  }

  findByIdempotency(key: string): AttendanceRecord | undefined {
    return this.byIdempotency.get(key);
  }

  count(): number {
    return this.byIdempotency.size;
  }

  list(): AttendanceRecord[] {
    return [...this.chronology];
  }
}
