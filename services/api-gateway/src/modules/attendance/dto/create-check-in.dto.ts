import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInStepUpDto {
  @IsIn(['supervisor_pin', 'qr', 'badge'])
  method!: 'supervisor_pin' | 'qr' | 'badge';

  @IsString()
  @MinLength(1)
  credential!: string;
}

export class CreateCheckInDto {
  @IsString()
  @MinLength(8)
  imageBase64!: string;

  @IsString()
  @MinLength(1)
  venueId!: string;

  @IsString()
  @MinLength(1)
  shiftId!: string;

  @IsIn(['in', 'out'])
  direction!: 'in' | 'out';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  candidateWorkerIds?: string[];

  /** Capture path — managed kiosk vs BYOD / remote selfie (C12). */
  @IsOptional()
  @IsIn(['managed_station', 'mobile_byod', 'remote_selfie'])
  captureSource?: 'managed_station' | 'mobile_byod' | 'remote_selfie';

  @IsOptional()
  @IsIn(['none', 'platform', 'hardware'])
  deviceAttestation?: 'none' | 'platform' | 'hardware';

  @IsOptional()
  @IsString()
  @MinLength(1)
  deviceModel?: string;

  @IsOptional()
  @IsIn(['unknown', 'native_camera', 'virtual_camera', 'file_inject'])
  pipelineHint?: 'unknown' | 'native_camera' | 'virtual_camera' | 'file_inject';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  anomalyFlags?: string[];

  /**
   * High-risk path: supervised step-up (PIN/QR/badge) to proceed toward match,
   * or set acceptReview to enqueue for human review only (C12).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckInStepUpDto)
  stepUp?: CheckInStepUpDto;

  @IsOptional()
  @IsBoolean()
  acceptReview?: boolean;
}
