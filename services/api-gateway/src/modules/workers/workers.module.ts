import { Module } from '@nestjs/common';
import { WorkersController } from './workers.controller.js';

@Module({
  controllers: [WorkersController],
})
export class WorkersModule {}
