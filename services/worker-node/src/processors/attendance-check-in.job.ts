export type AttendanceCheckInJob = {
  idempotencyKey: string;
  imageBase64: string;
  venueId: string;
  shiftId: string;
  direction: 'in' | 'out';
  candidateWorkerIds?: string[];
  stationId?: string;
  /** C12: high-risk capture queued for human review — no payroll write. */
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
