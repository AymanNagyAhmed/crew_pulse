import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CaptureHistoryOutcome,
  CaptureHistoryRecord,
} from './capture-history-record.js';
import type { AttendanceDirection } from './attendance-record.js';

export type CaptureHistoryInput = {
  idempotencyKey: string;
  venueId: string;
  shiftId: string;
  direction: AttendanceDirection;
  outcome: CaptureHistoryOutcome;
  workerId?: string;
  bestScore?: number;
  attendanceId?: string;
};

/**
 * Append-only capture history distinct from verified attendance (C9).
 * In-memory for now; swap for Postgres without changing the processor contract.
 */
@Injectable()
export class CaptureHistoryStore {
  private readonly byIdempotency = new Map<string, CaptureHistoryRecord>();
  private readonly chronology: CaptureHistoryRecord[] = [];

  record(input: CaptureHistoryInput): CaptureHistoryRecord {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const row: CaptureHistoryRecord = {
      id: `cap_${randomUUID().replaceAll('-', '')}`,
      idempotencyKey: input.idempotencyKey,
      venueId: input.venueId,
      shiftId: input.shiftId,
      direction: input.direction,
      outcome: input.outcome,
      ...(input.workerId !== undefined ? { workerId: input.workerId } : {}),
      ...(input.bestScore !== undefined ? { bestScore: input.bestScore } : {}),
      ...(input.attendanceId !== undefined
        ? { attendanceId: input.attendanceId }
        : {}),
      createdAt: new Date().toISOString(),
    };
    this.byIdempotency.set(input.idempotencyKey, row);
    this.chronology.push(row);
    return row;
  }

  findByIdempotency(key: string): CaptureHistoryRecord | undefined {
    return this.byIdempotency.get(key);
  }

  count(): number {
    return this.chronology.length;
  }

  list(): CaptureHistoryRecord[] {
    return [...this.chronology];
  }
}
