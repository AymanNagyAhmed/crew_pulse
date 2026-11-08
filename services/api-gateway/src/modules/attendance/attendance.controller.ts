import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { AttendanceService } from './attendance.service.js';
import { AssistedCheckInDto } from './dto/assisted-check-in.dto.js';
import { CreateCheckInDto } from './dto/create-check-in.dto.js';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @ResponseMessage('Attendance listed')
  list() {
    return this.attendanceService.list();
  }

  /**
   * Peak-load path: accept frame, enqueue BullMQ job, return 202 immediately.
   * Match + persist run on worker-node (vision-engine), not on this request.
   */
  @Post('check-ins')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Check-in accepted')
  enqueueCheckIn(
    @Body() body: CreateCheckInDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.attendanceService.enqueueCheckIn(body, idempotencyKey);
  }

  /**
   * Assisted fallback when vision returns assisted_fallback (heavy PPE / mask).
   * Supervisor PIN or station QR — never a silent biometric false reject.
   */
  @Post('assisted-check-ins')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Assisted check-in recorded')
  assistedCheckIn(
    @Body() body: AssistedCheckInDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.attendanceService.recordAssistedCheckIn(body, idempotencyKey);
  }

  @Get('jobs/:jobId')
  @ResponseMessage('Check-in job status')
  getJob(@Param('jobId') jobId: string) {
    return this.attendanceService.getJobStatus(jobId);
  }
}
