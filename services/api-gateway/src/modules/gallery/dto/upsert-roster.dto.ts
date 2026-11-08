import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertRosterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  venueId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  venueName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  shiftId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  shiftLabel?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  workerId!: string;
}
