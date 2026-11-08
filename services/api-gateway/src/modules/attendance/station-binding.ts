/**
 * Station / geofence binding for check-ins (C11).
 * Config: ATTENDANCE_STATION_VENUES=station_door_a:ven_1,station_door_b:ven_1
 */

export function parseStationVenueMap(
  raw?: string,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw?.trim()) {
    return map;
  }
  for (const part of raw.split(',')) {
    const [stationId, venueId] = part.split(':').map((s) => s.trim());
    if (stationId && venueId) {
      map.set(stationId, venueId);
    }
  }
  return map;
}

export type StationBindInput = {
  stationId?: string;
  venueId: string;
  /** When true (default in production-ish config), stationId is required. */
  requireStation: boolean;
  stationVenues: Map<string, string>;
  latitude?: number;
  longitude?: number;
  /** Optional venue geofence center + radius meters. */
  geofence?: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
};

export type StationBindResult =
  | { ok: true }
  | { ok: false; code: string; message: string; field: string };

export function assertStationBinding(
  input: StationBindInput,
): StationBindResult {
  if (input.requireStation && !input.stationId?.trim()) {
    return {
      ok: false,
      code: 'STATION_REQUIRED',
      message: 'stationId is required for payroll-grade check-in',
      field: 'stationId',
    };
  }

  if (input.stationId && input.stationVenues.size > 0) {
    const expected = input.stationVenues.get(input.stationId);
    if (!expected) {
      return {
        ok: false,
        code: 'STATION_UNKNOWN',
        message: `Station ${input.stationId} is not registered`,
        field: 'stationId',
      };
    }
    if (expected !== input.venueId) {
      return {
        ok: false,
        code: 'STATION_VENUE_MISMATCH',
        message: `Station ${input.stationId} is bound to ${expected}, not ${input.venueId}`,
        field: 'stationId',
      };
    }
  }

  if (input.geofence) {
    if (input.latitude === undefined || input.longitude === undefined) {
      return {
        ok: false,
        code: 'GEOFENCE_LOCATION_REQUIRED',
        message: 'latitude and longitude are required for this venue geofence',
        field: 'latitude',
      };
    }
    const dist = haversineMeters(
      input.latitude,
      input.longitude,
      input.geofence.lat,
      input.geofence.lng,
    );
    if (dist > input.geofence.radiusMeters) {
      return {
        ok: false,
        code: 'GEOFENCE_VIOLATION',
        message: `Capture is ${Math.round(dist)}m from venue (max ${input.geofence.radiusMeters}m)`,
        field: 'latitude',
      };
    }
  }

  return { ok: true };
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
