import { describe, expect, it } from 'vitest';
import {
  assertStationBinding,
  parseStationVenueMap,
} from './station-binding.js';

describe('station binding', () => {
  it('parses station→venue map', () => {
    const map = parseStationVenueMap('door_a:ven_1,door_b:ven_2');
    expect(map.get('door_a')).toBe('ven_1');
    expect(map.get('door_b')).toBe('ven_2');
  });

  it('requires station when configured', () => {
    const result = assertStationBinding({
      venueId: 'ven_1',
      requireStation: true,
      stationVenues: new Map(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STATION_REQUIRED');
    }
  });

  it('rejects station bound to another venue', () => {
    const result = assertStationBinding({
      stationId: 'door_a',
      venueId: 'ven_other',
      requireStation: true,
      stationVenues: new Map([['door_a', 'ven_1']]),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STATION_VENUE_MISMATCH');
    }
  });

  it('rejects outside geofence', () => {
    const result = assertStationBinding({
      stationId: 'door_a',
      venueId: 'ven_1',
      requireStation: false,
      stationVenues: new Map([['door_a', 'ven_1']]),
      latitude: 25.2,
      longitude: 55.3,
      geofence: { lat: 25.0, lng: 55.0, radiusMeters: 50 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GEOFENCE_VIOLATION');
    }
  });
});
