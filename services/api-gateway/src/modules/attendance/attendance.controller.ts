import { Controller, Get } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@Controller('attendance')
export class AttendanceController {
  @Get()
  @ResponseMessage('Attendance listed')
  list() {
    return { items: [] as unknown[], total: 0 };
  }
}
