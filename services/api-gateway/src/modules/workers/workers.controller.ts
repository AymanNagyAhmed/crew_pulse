import { Controller, Get } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@Controller('workers')
export class WorkersController {
  @Get()
  @ResponseMessage('Workers listed')
  list() {
    return { items: [] as unknown[], total: 0 };
  }
}
