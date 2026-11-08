import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Supervisor override — writes immutable audit only (C11).
 * Does not create a verified payroll attendance row.
 */
export class CreateOverrideDto {
  @IsString()
  @MinLength(1)
  venueId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  shiftId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  workerId?: string;

  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: 'in' | 'out';

  @IsString()
  @MinLength(1)
  actorId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  relatedId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
