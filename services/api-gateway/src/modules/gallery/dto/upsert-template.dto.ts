import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FACE_EMBEDDING_DIM } from '../../database/database.constants.js';

export class UpsertTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  workerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  displayName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  modelVersion!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  templateVersion?: number;

  @IsArray()
  @ArrayMinSize(FACE_EMBEDDING_DIM)
  @ArrayMaxSize(FACE_EMBEDDING_DIM)
  @IsNumber({}, { each: true })
  embedding!: number[];
}
