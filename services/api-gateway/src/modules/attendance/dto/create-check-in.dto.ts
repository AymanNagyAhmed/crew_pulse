import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

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

  /** Capture station id — bound to venue when ATTENDANCE_STATION_VENUES is set (C11). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  stationId?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
