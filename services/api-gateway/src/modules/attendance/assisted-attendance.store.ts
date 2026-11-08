import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type AssistedAttendanceRecord = {
  id: string;
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  method: 'supervisor_pin' | 'qr';
  reason?: string;
  idempotencyKey: string;
  punchedAt: string;
  createdAt: string;
};

/**
 * Assisted (PIN/QR) punches when biometrics cannot run (heavy PPE/occlusion).
 * In-memory until shared Postgres attendance store lands (C11).
 */
@Injectable()
export class AssistedAttendanceStore {
  private readonly byIdempotency = new Map<string, AssistedAttendanceRecord>();
  private readonly chronology: AssistedAttendanceRecord[] = [];

  write(
    input: Omit<AssistedAttendanceRecord, 'id' | 'createdAt' | 'punchedAt'> & {
      punchedAt?: string;
    },
  ): { created: boolean; record: AssistedAttendanceRecord } {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing) {
      return { created: false, record: existing };
    }
    const record: AssistedAttendanceRecord = {
      id: `att_assist_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
      workerId: input.workerId,
      venueId: input.venueId,
      shiftId: input.shiftId,
      direction: input.direction,
      method: input.method,
      ...(input.reason ? { reason: input.reason } : {}),
      idempotencyKey: input.idempotencyKey,
      punchedAt: input.punchedAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.byIdempotency.set(input.idempotencyKey, record);
    this.chronology.push(record);
    return { created: true, record };
  }

  list(): AssistedAttendanceRecord[] {
    return [...this.chronology];
  }
}
