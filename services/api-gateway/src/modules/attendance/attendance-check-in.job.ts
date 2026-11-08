/** Job payload enqueued by api-gateway; consumed by worker-node. */
export type AttendanceCheckInJob = {
  idempotencyKey: string;
  imageBase64: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  candidateWorkerIds?: string[];
  /** C12: when true, worker must not write payroll — return needs_review. */
  forceReview?: boolean;
  captureSource?: 'managed_station' | 'mobile_byod' | 'remote_selfie';
  riskTier?: 'payroll' | 'high';
};

export type AttendanceCheckInResult = {
  status:
    | 'matched'
    | 'no_match'
    | 'needs_review'
    | 'assisted_fallback'
    | 'duplicate'
    | 'cooldown'
    | 'vision_error';
  idempotencyKey: string;
  workerId?: string;
  attendanceId?: string;
  bestScore?: number;
  decision?: 'matched' | 'no_match' | 'needs_review' | 'assisted_fallback';
  message?: string;
};
