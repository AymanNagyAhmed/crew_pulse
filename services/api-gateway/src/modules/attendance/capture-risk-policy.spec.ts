import { describe, expect, it } from 'vitest';
import {
  evaluateCaptureRisk,
  parsePayrollAllowedSources,
} from './capture-risk-policy.js';

describe('capture risk policy', () => {
  it('treats managed station as payroll-grade by default', () => {
    const d = evaluateCaptureRisk({
      captureSource: 'managed_station',
      pipelineHint: 'native_camera',
      payrollAllowedSources: parsePayrollAllowedSources(undefined),
    });
    expect(d.tier).toBe('payroll');
    expect(d.requireStepUp).toBe(false);
  });

  it('marks remote selfie as high risk requiring step-up', () => {
    const d = evaluateCaptureRisk({
      captureSource: 'remote_selfie',
      deviceAttestation: 'none',
      payrollAllowedSources: ['managed_station'],
    });
    expect(d.tier).toBe('high');
    expect(d.requireStepUp).toBe(true);
    expect(d.reasons).toContain('source_remote_selfie');
  });

  it('escalates managed station on virtual-camera pipeline', () => {
    const d = evaluateCaptureRisk({
      captureSource: 'managed_station',
      pipelineHint: 'virtual_camera',
      payrollAllowedSources: ['managed_station'],
    });
    expect(d.tier).toBe('high');
    expect(d.reasons).toContain('pipeline_virtual_camera');
  });
});
