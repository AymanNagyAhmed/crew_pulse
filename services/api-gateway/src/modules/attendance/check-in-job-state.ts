import type { AttendanceCheckInResult } from './attendance-check-in.job.js';

/** Door / client UX states for async check-in (C9). */
export type CheckInUxState =
  | 'queued'
  | 'matched'
  | 'needs_review'
  | 'no_match'
  | 'assisted_fallback'
  | 'duplicate'
  | 'cooldown'
  | 'failed';

/**
 * Map BullMQ job state + processor return value to stable UX states.
 * Clients should poll until not `queued`.
 */
export function mapCheckInUxState(
  bullState: string,
  result?: AttendanceCheckInResult,
): CheckInUxState {
  if (bullState === 'failed') {
    return 'failed';
  }

  if (bullState === 'completed' && result) {
    const decision = result.decision ?? undefined;
    const status = result.status;

    if (status === 'matched' || decision === 'matched') {
      return 'matched';
    }
    if (status === 'needs_review' || decision === 'needs_review') {
      return 'needs_review';
    }
    if (status === 'no_match' || decision === 'no_match') {
      return 'no_match';
    }
    if (status === 'assisted_fallback' || decision === 'assisted_fallback') {
      return 'assisted_fallback';
    }
    if (status === 'duplicate') {
      return 'duplicate';
    }
    if (status === 'cooldown') {
      return 'cooldown';
    }
    if (status === 'vision_error') {
      return 'failed';
    }
  }

  // waiting | delayed | active | prioritized | paused | waiting-children
  return 'queued';
}
