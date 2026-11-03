import { Controller, Get } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@Controller('shifts')
export class ShiftsController {
  @Get()
  @ResponseMessage('Shifts listed')
  list() {
    return { items: [] as unknown[], total: 0 };
  }
}
