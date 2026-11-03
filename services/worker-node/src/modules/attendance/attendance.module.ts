import { Module } from '@nestjs/common';
import { AttendanceStore } from './attendance.store.js';

@Module({
  providers: [AttendanceStore],
  exports: [AttendanceStore],
})
export class AttendanceModule {}
