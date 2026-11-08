import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FACE_EMBEDDING_DIM } from '../../database/database.constants.js';

/** Capture QA from vision detect — enrollment rejects frames that would poison the gallery. */
export class EnrollmentCaptureQaDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  blur!: number;

  @IsInt()
  @Min(1)
  faceSizePx!: number;

  @IsNumber()
  yawDeg!: number;

  @IsNumber()
  pitchDeg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  detectionScore?: number;
}

export class EnrollTemplateItemDto {
  @IsArray()
  @ArrayMinSize(FACE_EMBEDDING_DIM)
  @ArrayMaxSize(FACE_EMBEDDING_DIM)
  @IsNumber({}, { each: true })
  embedding!: number[];

  /** When omitted, versions are assigned 1..N in request order (multi-template enroll). */
  @IsOptional()
  @IsInt()
  @Min(1)
  templateVersion?: number;

  @ValidateNested()
  @Type(() => EnrollmentCaptureQaDto)
  captureQa!: EnrollmentCaptureQaDto;
}

export class EnrollTemplatesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  workerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  displayName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  modelVersion!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => EnrollTemplateItemDto)
  templates!: EnrollTemplateItemDto[];
}
