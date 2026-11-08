import { IsOptional, IsString, MinLength } from 'class-validator';

export class RetentionPurgeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  requestedBy?: string;

  /** ISO-8601; defaults to now. Purge workers with retentionUntil <= asOf. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  asOf?: string;
}
