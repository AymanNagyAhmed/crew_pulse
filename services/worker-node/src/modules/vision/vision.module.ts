import { Module } from '@nestjs/common';
import { VisionClientService } from './vision-client.service.js';

@Module({
  providers: [VisionClientService],
  exports: [VisionClientService],
})
export class VisionModule {}
