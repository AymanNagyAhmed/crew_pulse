import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class AssistedCheckInDto {
  @IsString()
  @MinLength(1)
  venueId!: string;

  @IsString()
  @MinLength(1)
  shiftId!: string;

  @IsIn(['in', 'out'])
  direction!: 'in' | 'out';

  @IsString()
  @MinLength(1)
  workerId!: string;

  @IsIn(['supervisor_pin', 'qr', 'badge'])
  method!: 'supervisor_pin' | 'qr' | 'badge';

  @IsString()
  @MinLength(4)
  credential!: string;

  /** Vision reject code that triggered assisted flow (e.g. face_occluded). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
