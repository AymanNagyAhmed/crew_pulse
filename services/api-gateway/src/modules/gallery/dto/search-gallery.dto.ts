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
} from 'class-validator';
import { FACE_EMBEDDING_DIM } from '../../database/database.constants.js';

export class SearchGalleryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  venueId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  shiftId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  modelVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsArray()
  @ArrayMinSize(FACE_EMBEDDING_DIM)
  @ArrayMaxSize(FACE_EMBEDDING_DIM)
  @IsNumber({}, { each: true })
  embedding!: number[];
}
