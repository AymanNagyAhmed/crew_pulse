import { Module } from '@nestjs/common';
import { GalleryController } from './gallery.controller.js';
import { GalleryService } from './gallery.service.js';
import { TemplateCryptoService } from './template-crypto.service.js';

@Module({
  controllers: [GalleryController],
  providers: [TemplateCryptoService, GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
