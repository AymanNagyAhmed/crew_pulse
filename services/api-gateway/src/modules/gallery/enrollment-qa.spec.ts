import { describe, expect, it } from 'vitest';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { assertEnrollmentQa } from './enrollment-qa.js';

const good = {
  blur: 0.1,
  faceSizePx: 140,
  yawDeg: 2,
  pitchDeg: -1,
  detectionScore: 0.96,
};

describe('assertEnrollmentQa', () => {
  it('accepts a frontal sharp frame', () => {
    expect(() => assertEnrollmentQa(good, 0)).not.toThrow();
  });

  it('rejects blurry enrollment frames', () => {
    expect(() =>
      assertEnrollmentQa({ ...good, blur: 0.7 }, 0),
    ).toThrow(DomainException);
  });

  it('rejects extreme yaw', () => {
    expect(() =>
      assertEnrollmentQa({ ...good, yawDeg: 35 }, 1),
    ).toThrow(/ENROLLMENT_QUALITY_FAILED|yaw/i);
  });
});
