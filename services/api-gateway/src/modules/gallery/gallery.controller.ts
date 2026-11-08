import { Body, Controller, HttpCode, Put, Post } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { SearchGalleryDto } from './dto/search-gallery.dto.js';
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
