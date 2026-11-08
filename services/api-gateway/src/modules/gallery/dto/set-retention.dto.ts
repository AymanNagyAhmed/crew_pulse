import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class SetRetentionDto {
  /**
   * ISO-8601 instant after which retention purge may erase templates.
   * Omit or null-equivalent via erase path to clear purpose early.
   */
  @IsISO8601()
  retentionUntil!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
