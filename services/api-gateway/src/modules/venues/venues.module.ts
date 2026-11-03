import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller.js';

@Module({
  controllers: [VenuesController],
})
export class VenuesModule {}
