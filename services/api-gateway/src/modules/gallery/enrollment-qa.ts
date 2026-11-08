import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { EnrollmentCaptureQaDto } from './dto/enroll-templates.dto.js';

export type EnrollmentQaLimits = {
  maxBlur: number;
  minFaceSizePx: number;
  maxYawDeg: number;
  maxPitchDeg: number;
  minDetectionScore: number;
};

export const DEFAULT_ENROLLMENT_QA: EnrollmentQaLimits = {
  maxBlur: 0.45,
  minFaceSizePx: 100,
  maxYawDeg: 20,
  maxPitchDeg: 15,
  minDetectionScore: 0.85,
};

export function assertEnrollmentQa(
  qa: EnrollmentCaptureQaDto,
  index: number,
  limits: EnrollmentQaLimits = DEFAULT_ENROLLMENT_QA,
): void {
  const field = `templates[${index}].captureQa`;
  if (qa.faceSizePx < limits.minFaceSizePx) {
    throw new DomainException(
      'ENROLLMENT_QUALITY_FAILED',
      `Enrollment frame ${index} face too small for a durable template`,
      422,
      [
        {
          field,
          issue: `faceSizePx ${qa.faceSizePx} < ${limits.minFaceSizePx}`,
        },
      ],
    );
  }
  if (qa.blur > limits.maxBlur) {
    throw new DomainException(
      'ENROLLMENT_QUALITY_FAILED',
      `Enrollment frame ${index} is too blurry`,
      422,
      [{ field, issue: `blur ${qa.blur} > ${limits.maxBlur}` }],
    );
  }
  if (Math.abs(qa.yawDeg) > limits.maxYawDeg) {
    throw new DomainException(
      'ENROLLMENT_QUALITY_FAILED',
      `Enrollment frame ${index} yaw out of bounds`,
      422,
      [{ field, issue: `yawDeg ${qa.yawDeg} exceeds ±${limits.maxYawDeg}` }],
    );
  }
  if (Math.abs(qa.pitchDeg) > limits.maxPitchDeg) {
    throw new DomainException(
      'ENROLLMENT_QUALITY_FAILED',
      `Enrollment frame ${index} pitch out of bounds`,
      422,
      [
        {
          field,
          issue: `pitchDeg ${qa.pitchDeg} exceeds ±${limits.maxPitchDeg}`,
        },
      ],
    );
  }
  const score = qa.detectionScore ?? 1;
  if (score < limits.minDetectionScore) {
    throw new DomainException(
      'ENROLLMENT_QUALITY_FAILED',
      `Enrollment frame ${index} detection confidence too low`,
      422,
      [
        {
          field,
          issue: `detectionScore ${score} < ${limits.minDetectionScore}`,
        },
      ],
    );
  }
}
