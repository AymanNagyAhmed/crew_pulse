/** Job payload enqueued by api-gateway; consumed by worker-node. */
export type AttendanceCheckInJob = {
  idempotencyKey: string;
  imageBase64: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  candidateWorkerIds?: string[];
};

export type AttendanceCheckInResult = {
  status:
    | 'matched'
    | 'no_match'
    | 'needs_review'
    | 'duplicate'
    | 'cooldown'
    | 'vision_error';
  idempotencyKey: string;
  workerId?: string;
  attendanceId?: string;
  bestScore?: number;
  decision?: 'matched' | 'no_match' | 'needs_review';
  message?: string;
};
