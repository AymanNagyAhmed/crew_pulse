import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { EnrollTemplatesDto } from './dto/enroll-templates.dto.js';
import { EraseBiometricsDto } from './dto/erase-biometrics.dto.js';
import { RetentionPurgeDto } from './dto/retention-purge.dto.js';
import { SearchGalleryDto } from './dto/search-gallery.dto.js';
import { SetRetentionDto } from './dto/set-retention.dto.js';
import { UpsertRosterDto } from './dto/upsert-roster.dto.js';
import { UpsertTemplateDto } from './dto/upsert-template.dto.js';
import { GalleryService } from './gallery.service.js';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Put('templates')
  @ResponseMessage('Face template upserted')
  upsertTemplate(@Body() dto: UpsertTemplateDto) {
    return this.gallery.upsertTemplate(dto);
  }

  /** Multi-frame enrollment with capture QA (C6). */
  @Post('enroll')
  @HttpCode(201)
  @ResponseMessage('Worker templates enrolled')
  enroll(@Body() dto: EnrollTemplatesDto) {
    return this.gallery.enrollTemplates(dto);
  }

  @Get('workers/:workerId/templates')
  @ResponseMessage('Worker templates listed')
  listTemplates(
    @Param('workerId') workerId: string,
    @Query('modelVersion') modelVersion?: string,
  ) {
    return this.gallery.listTemplates(workerId, modelVersion);
  }

  /** Erase biometric templates (+ roster by default) with audit evidence (C7). */
  @Delete('workers/:workerId/biometrics')
  @ResponseMessage('Worker biometrics erased')
  eraseBiometrics(
    @Param('workerId') workerId: string,
    @Body() dto: EraseBiometricsDto,
  ) {
    return this.gallery.eraseBiometrics(workerId, dto);
  }

  /** Set purpose/employment end for automated retention purge (C7). */
  @Put('workers/:workerId/retention')
  @ResponseMessage('Biometric retention updated')
  setRetention(
    @Param('workerId') workerId: string,
    @Body() dto: SetRetentionDto,
  ) {
    return this.gallery.setRetention(workerId, dto);
  }

  /** Purge templates whose retentionUntil has elapsed (C7). */
  @Post('retention/purge')
  @HttpCode(200)
  @ResponseMessage('Expired biometric templates purged')
  purgeRetention(@Body() dto: RetentionPurgeDto) {
    return this.gallery.purgeExpired(dto);
  }

  @Put('roster')
  @ResponseMessage('Shift roster membership upserted')
  upsertRoster(@Body() dto: UpsertRosterDto) {
    return this.gallery.upsertRoster(dto);
  }

  @Post('search')
  @HttpCode(200)
  @ResponseMessage('Roster-scoped gallery search complete')
  search(@Body() dto: SearchGalleryDto) {
    return this.gallery.search(dto);
  }
}
