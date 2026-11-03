import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [QueuesModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
