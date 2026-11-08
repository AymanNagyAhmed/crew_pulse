import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type EdgeSyncedPunch = {
  id: string;
  deviceEventId: string;
  edgeNodeId: string;
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  matchedAtLocal: string;
  /** Server authority timestamp used for payroll. */
  acceptedAt: string;
  score?: number;
  uplink: 'metadata' | 'crop' | 'embedding';
  createdAt: string;
};

/**
 * Cloud-side store for punches synced from offline edge nodes (C10).
 * Idempotent on deviceEventId — re-upload never double-writes payroll rows.
 */
@Injectable()
export class EdgePunchStore {
  private readonly byDeviceEvent = new Map<string, EdgeSyncedPunch>();
  private readonly chronology: EdgeSyncedPunch[] = [];

  write(
    input: Omit<EdgeSyncedPunch, 'id' | 'createdAt' | 'acceptedAt'> & {
      acceptedAt?: string;
    },
  ): { created: boolean; record: EdgeSyncedPunch } {
    const existing = this.byDeviceEvent.get(input.deviceEventId);
    if (existing) {
      return { created: false, record: existing };
    }
    const record: EdgeSyncedPunch = {
      id: `att_edge_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
      deviceEventId: input.deviceEventId,
      edgeNodeId: input.edgeNodeId,
      workerId: input.workerId,
      venueId: input.venueId,
      shiftId: input.shiftId,
      direction: input.direction,
      matchedAtLocal: input.matchedAtLocal,
      acceptedAt: input.acceptedAt ?? new Date().toISOString(),
      ...(input.score !== undefined ? { score: input.score } : {}),
      uplink: input.uplink,
      createdAt: new Date().toISOString(),
    };
    this.byDeviceEvent.set(input.deviceEventId, record);
    this.chronology.push(record);
    return { created: true, record };
  }

  findByDeviceEvent(deviceEventId: string): EdgeSyncedPunch | undefined {
    return this.byDeviceEvent.get(deviceEventId);
  }

  count(): number {
    return this.chronology.length;
  }

  list(): EdgeSyncedPunch[] {
    return [...this.chronology];
  }
}
