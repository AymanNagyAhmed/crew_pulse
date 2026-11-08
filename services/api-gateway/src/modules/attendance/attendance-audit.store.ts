import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type AttendanceAuditKind =
  | 'override'
  | 'low_confidence_accept'
  | 'pad_fail'
  | 'station_reject';

export type AttendanceAuditRecord = {
  id: string;
  kind: AttendanceAuditKind;
  venueId: string;
  shiftId?: string;
  workerId?: string;
  direction?: 'in' | 'out';
  actorId: string;
  reason: string;
  /** Optional related attendance / job id — never mutates payroll by itself. */
  relatedId?: string;
  confidence?: number;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
};

/**
 * Immutable audit trail for overrides and risk accepts (C11).
 * Append-only in-memory store; swap for append-only Postgres later.
 */
@Injectable()
export class AttendanceAuditStore {
  private readonly rows: AttendanceAuditRecord[] = [];

  append(
    input: Omit<AttendanceAuditRecord, 'id' | 'createdAt'>,
  ): AttendanceAuditRecord {
    const record: AttendanceAuditRecord = {
      ...input,
      id: `aud_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(record);
    return record;
  }

  list(): AttendanceAuditRecord[] {
    return [...this.rows];
  }

  count(): number {
    return this.rows.length;
  }
}
