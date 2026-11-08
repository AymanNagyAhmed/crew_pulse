import { describe, expect, it, vi } from 'vitest';
import { EdgePunchStore } from './edge-punch.store.js';
import { EdgeService } from './edge.service.js';

describe('EdgeService', () => {
  it('writes offline punches once and dedupes on re-sync', () => {
    const gallery = {
      listEdgeRoster: vi.fn(),
    };
    const service = new EdgeService(gallery as never, new EdgePunchStore());

    const first = service.syncOfflinePunches({
      venueId: 'ven_1',
      edgeNodeId: 'edge_kitchen_a',
      punches: [
        {
          deviceEventId: 'dev_evt_001',
          workerId: 'wrk_1',
          shiftId: 'shf_1',
          direction: 'in',
          matchedAtLocal: '2026-11-08T10:00:00.000Z',
          score: 0.91,
          uplink: 'metadata',
        },
      ],
    });
    expect(first.written).toBe(1);
    expect(first.duplicates).toBe(0);
    expect(first.serverAuthority).toBe(true);

    const second = service.syncOfflinePunches({
      venueId: 'ven_1',
      edgeNodeId: 'edge_kitchen_a',
      punches: [
        {
          deviceEventId: 'dev_evt_001',
          workerId: 'wrk_1',
          shiftId: 'shf_1',
          direction: 'in',
          matchedAtLocal: '2026-11-08T10:00:00.000Z',
          uplink: 'metadata',
        },
      ],
    });
    expect(second.written).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(second.items[0]?.attendanceId).toBe(first.items[0]?.attendanceId);
  });

  it('rejects crop uplink without crop bytes', () => {
    const service = new EdgeService(
      { listEdgeRoster: vi.fn() } as never,
      new EdgePunchStore(),
    );
    const result = service.syncOfflinePunches({
      venueId: 'ven_1',
      edgeNodeId: 'edge_1',
      punches: [
        {
          deviceEventId: 'dev_evt_crop',
          workerId: 'wrk_1',
          shiftId: 'shf_1',
          direction: 'in',
          matchedAtLocal: '2026-11-08T10:00:00.000Z',
          uplink: 'crop',
        },
      ],
    });
    expect(result.rejected).toBe(1);
    expect(result.items[0]?.status).toBe('rejected');
  });
});
