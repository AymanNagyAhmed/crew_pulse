import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class EraseBiometricsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  requestedBy?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;

  /** Also remove worker from all shift rosters (default true). */
  @IsOptional()
  @IsBoolean()
  removeFromRosters?: boolean;
}
