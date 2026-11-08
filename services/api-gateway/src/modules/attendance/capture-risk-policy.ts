/**
 * Capture-source risk policy against digital injection / deepfakes (C12).
 * Managed stations (locked camera path) are payroll-grade; BYOD / remote selfie are high risk.
 */

export type CaptureSource =
  | 'managed_station'
  | 'mobile_byod'
  | 'remote_selfie';

export type CaptureRiskTier = 'payroll' | 'high';

export type CaptureRiskInput = {
  captureSource?: CaptureSource;
  /** OS/SDK camera attestation when available (mobile). */
  deviceAttestation?: 'none' | 'platform' | 'hardware';
  deviceModel?: string;
  /** Hint from client pipeline — virtual cameras are injection-prone. */
  pipelineHint?: 'unknown' | 'native_camera' | 'virtual_camera' | 'file_inject';
  /** Anomaly: unrealistically perfect studio lighting on a kitchen punch. */
  anomalyFlags?: string[];
  payrollAllowedSources: CaptureSource[];
};

export type CaptureRiskDecision =
  | {
      tier: 'payroll';
      captureSource: CaptureSource;
      requireStepUp: false;
      forceReview: false;
      reasons: string[];
    }
  | {
      tier: 'high';
      captureSource: CaptureSource;
      requireStepUp: true;
      forceReview: boolean;
      reasons: string[];
    };

const DEFAULT_PAYROLL_SOURCES: CaptureSource[] = ['managed_station'];

export function parsePayrollAllowedSources(raw?: string): CaptureSource[] {
  if (!raw?.trim()) {
    return [...DEFAULT_PAYROLL_SOURCES];
  }
  const allowed = new Set<CaptureSource>([
    'managed_station',
    'mobile_byod',
    'remote_selfie',
  ]);
  const out: CaptureSource[] = [];
  for (const part of raw.split(',')) {
    const s = part.trim() as CaptureSource;
    if (allowed.has(s) && !out.includes(s)) {
      out.push(s);
    }
  }
  return out.length > 0 ? out : [...DEFAULT_PAYROLL_SOURCES];
}

export function evaluateCaptureRisk(
  input: CaptureRiskInput,
): CaptureRiskDecision {
  const captureSource = input.captureSource ?? 'managed_station';
  const reasons: string[] = [];
  const anomalies = input.anomalyFlags ?? [];

  if (input.pipelineHint === 'virtual_camera' || input.pipelineHint === 'file_inject') {
    reasons.push(`pipeline_${input.pipelineHint}`);
  }
  if (anomalies.includes('perfect_studio_lighting')) {
    reasons.push('anomaly_perfect_studio_lighting');
  }
  if (anomalies.includes('unknown_device_model') || input.deviceModel === 'unknown') {
    reasons.push('anomaly_unknown_device');
  }

  const onPayrollAllowlist = input.payrollAllowedSources.includes(captureSource);
  const attestationWeak =
    captureSource !== 'managed_station' &&
    (input.deviceAttestation === undefined ||
      input.deviceAttestation === 'none');

  if (attestationWeak) {
    reasons.push('missing_device_attestation');
  }

  const injectionSignals = reasons.some((r) =>
    r.startsWith('pipeline_') || r.startsWith('anomaly_'),
  );

  if (onPayrollAllowlist && !injectionSignals && captureSource === 'managed_station') {
    return {
      tier: 'payroll',
      captureSource,
      requireStepUp: false,
      forceReview: false,
      reasons: [],
    };
  }

  // High risk: BYOD / remote selfie, or managed station with injection anomalies.
  reasons.unshift(`source_${captureSource}`);
  return {
    tier: 'high',
    captureSource,
    requireStepUp: true,
    forceReview: true,
    reasons,
  };
}
