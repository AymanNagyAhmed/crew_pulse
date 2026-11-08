import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { GalleryService } from '../gallery/gallery.service.js';
import type { SyncOfflinePunchesDto } from './dto/sync-offline-punches.dto.js';
import { EdgePunchStore } from './edge-punch.store.js';

export type SyncPunchResultItem = {
  deviceEventId: string;
  status: 'written' | 'duplicate' | 'rejected';
  attendanceId?: string;
  reason?: string;
};

export type SyncOfflinePunchesResult = {
  venueId: string;
  edgeNodeId: string;
  serverAuthority: true;
  acceptedAt: string;
  written: number;
  duplicates: number;
  rejected: number;
  items: SyncPunchResultItem[];
};

@Injectable()
export class EdgeService {
  constructor(
    private readonly gallery: GalleryService,
    private readonly punches: EdgePunchStore,
  ) {}

  listRoster(venueId: string, shiftId: string) {
    return this.gallery.listEdgeRoster(venueId, shiftId);
  }

  syncOfflinePunches(dto: SyncOfflinePunchesDto): SyncOfflinePunchesResult {
    const acceptedAt = new Date().toISOString();
    const items: SyncPunchResultItem[] = [];
    let written = 0;
    let duplicates = 0;
    let rejected = 0;

    for (const punch of dto.punches) {
      if (punch.uplink === 'crop' && !punch.cropBase64) {
        rejected += 1;
        items.push({
          deviceEventId: punch.deviceEventId,
          status: 'rejected',
          reason: 'crop uplink requires cropBase64',
        });
        continue;
      }
      if (punch.cropBase64 && punch.cropBase64.length > 200_000) {
        rejected += 1;
        items.push({
          deviceEventId: punch.deviceEventId,
          status: 'rejected',
          reason: 'crop exceeds max uplink size (send crop/embedding, not 4K)',
        });
        continue;
      }

      const localMs = Date.parse(punch.matchedAtLocal);
      if (!Number.isFinite(localMs)) {
        rejected += 1;
        items.push({
          deviceEventId: punch.deviceEventId,
          status: 'rejected',
          reason: 'matchedAtLocal is not a valid instant',
        });
        continue;
      }

      // Server authority: accept the punch but stamp payroll time from the cloud clock.
      // Extreme skew is flagged but still recorded for audit (ops review).
      const skewMs = Math.abs(Date.parse(acceptedAt) - localMs);
      const { created, record } = this.punches.write({
        deviceEventId: punch.deviceEventId,
        edgeNodeId: dto.edgeNodeId,
        workerId: punch.workerId,
        venueId: dto.venueId,
        shiftId: punch.shiftId,
        direction: punch.direction,
        matchedAtLocal: punch.matchedAtLocal,
        acceptedAt,
        uplink: punch.uplink,
        ...(punch.score !== undefined ? { score: punch.score } : {}),
      });

      if (!created) {
        duplicates += 1;
        items.push({
          deviceEventId: punch.deviceEventId,
          status: 'duplicate',
          attendanceId: record.id,
        });
        continue;
      }

      written += 1;
      items.push({
        deviceEventId: punch.deviceEventId,
        status: 'written',
        attendanceId: record.id,
        ...(skewMs > 15 * 60 * 1000
          ? { reason: `clock_skew_ms=${skewMs}; server acceptedAt used for payroll` }
          : {}),
      });
    }

    return {
      venueId: dto.venueId,
      edgeNodeId: dto.edgeNodeId,
      serverAuthority: true,
      acceptedAt,
      written,
      duplicates,
      rejected,
      items,
    };
  }

  getPunch(deviceEventId: string) {
    const record = this.punches.findByDeviceEvent(deviceEventId);
    if (!record) {
      throw new DomainException(
        'EDGE_PUNCH_NOT_FOUND',
        `No synced edge punch with deviceEventId ${deviceEventId}`,
        404,
      );
    }
    return record;
  }
}
