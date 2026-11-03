export type AttendanceDirection = 'in' | 'out';

export type AttendanceRecord = {
  id: string;
  workerId: string;
  venueId: string;
  shiftId: string;
  direction: AttendanceDirection;
  matchedAt: string;
  score?: number;
  idempotencyKey: string;
  createdAt: string;
};
