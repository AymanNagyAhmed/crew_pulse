import { Module } from '@nestjs/common';
import { GalleryModule } from '../gallery/gallery.module.js';
import { EdgeController } from './edge.controller.js';
import { EdgePunchStore } from './edge-punch.store.js';
import { EdgeService } from './edge.service.js';

@Module({
  imports: [GalleryModule],
  controllers: [EdgeController],
  providers: [EdgePunchStore, EdgeService],
  exports: [EdgeService, EdgePunchStore],
})
export class EdgeModule {}
