import type { AttendanceDirection } from './attendance-record.js';

/**
 * Raw capture attempt history (C9) — separate from verified attendance.
 * Never stores image bytes; only metadata for audit / latency tracing.
 */
export type CaptureHistoryOutcome =
  | 'matched'
  | 'no_match'
  | 'needs_review'
  | 'assisted_fallback'
  | 'vision_error'
  | 'circuit_open'
  | 'cooldown'
  | 'duplicate';

export type CaptureHistoryRecord = {
  id: string;
  idempotencyKey: string;
  venueId: string;
  shiftId: string;
  direction: AttendanceDirection;
  outcome: CaptureHistoryOutcome;
  workerId?: string;
  bestScore?: number;
  /** Set only when a verified attendance row was written for this capture. */
  attendanceId?: string;
  createdAt: string;
};
