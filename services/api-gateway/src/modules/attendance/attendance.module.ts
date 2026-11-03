import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';

@Module({
  controllers: [AttendanceController],
})
export class AttendanceModule {}
