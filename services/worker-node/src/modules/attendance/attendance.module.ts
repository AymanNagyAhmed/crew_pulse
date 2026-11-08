import { Module } from '@nestjs/common';
import { AttendanceStore } from './attendance.store.js';
import { CaptureHistoryStore } from './capture-history.store.js';

@Module({
  providers: [AttendanceStore, CaptureHistoryStore],
  exports: [AttendanceStore, CaptureHistoryStore],
})
export class AttendanceModule {}
