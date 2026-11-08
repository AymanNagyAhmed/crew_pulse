export type AttendanceLogJob = {
  /** Stable idempotency key from gateway / device */
  idempotencyKey: string;
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  matchedAt: string;
  score?: number;
  stationId?: string;
};
