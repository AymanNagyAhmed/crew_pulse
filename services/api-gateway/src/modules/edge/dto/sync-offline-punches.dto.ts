import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OfflinePunchDto {
  /** Stable device-side event id — primary idempotency key for sync. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  deviceEventId!: string;

  @IsString()
  @MinLength(1)
  workerId!: string;

  @IsString()
  @MinLength(1)
  shiftId!: string;

  @IsIn(['in', 'out'])
  direction!: 'in' | 'out';

  /** Wall clock on the edge device at match time (ISO-8601). */
  @IsISO8601()
  matchedAtLocal!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  score?: number;

  /**
   * What the edge uplinked — never raw 4K video.
   * `metadata` = ids only; `crop` = quality-checked face crop; `embedding` = vector on managed link.
   */
  @IsIn(['metadata', 'crop', 'embedding'])
  uplink!: 'metadata' | 'crop' | 'embedding';

  /** Optional quality-checked crop (base64). Hard-capped — not a video dump. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  cropBase64?: string;
}

export class SyncOfflinePunchesDto {
  @IsString()
  @MinLength(1)
  venueId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  edgeNodeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OfflinePunchDto)
  punches!: OfflinePunchDto[];
}
