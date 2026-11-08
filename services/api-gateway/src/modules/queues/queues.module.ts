import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ATTENDANCE_CHECK_IN_QUEUE } from './queue.constants.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue({ name: ATTENDANCE_CHECK_IN_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
