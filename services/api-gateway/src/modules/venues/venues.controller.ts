import { Controller, Get } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@Controller('venues')
export class VenuesController {
  @Get()
  @ResponseMessage('Venues listed')
  list() {
    return { items: [] as unknown[], total: 0 };
  }
}
