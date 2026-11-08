import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module.js';
import { AssistedAttendanceStore } from './assisted-attendance.store.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [QueuesModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AssistedAttendanceStore],
})
export class AttendanceModule {}
