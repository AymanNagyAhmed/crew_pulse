import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
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
}
