/**
 * Challenge 11 style key: (workerId, venueId, shiftId, direction, timeBucket).
 * Used when the producer does not supply its own idempotencyKey.
 */
export function buildAttendanceIdempotencyKey(input: {
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  matchedAt: string;
  bucketSeconds?: number;
}): string {
  const bucketSeconds = input.bucketSeconds ?? 60;
  const ms = Date.parse(input.matchedAt);
  const bucket = Number.isFinite(ms)
    ? Math.floor(ms / (bucketSeconds * 1000))
    : 0;
  return [
    input.workerId,
    input.venueId,
    input.shiftId,
    input.direction,
    String(bucket),
  ].join(':');
}
