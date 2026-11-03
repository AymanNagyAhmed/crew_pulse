import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttendanceLogProcessor } from '../../processors/attendance-log.processor.js';
import { WebhookProcessor } from '../../processors/webhook.processor.js';
import { IdempotencyService } from './idempotency.service.js';
import { ATTENDANCE_LOG_QUEUE, WEBHOOK_QUEUE } from './queue.constants.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue(
      { name: ATTENDANCE_LOG_QUEUE },
      { name: WEBHOOK_QUEUE },
    ),
  ],
  providers: [IdempotencyService, AttendanceLogProcessor, WebhookProcessor],
  exports: [BullModule, IdempotencyService],
})
export class QueuesModule {}
