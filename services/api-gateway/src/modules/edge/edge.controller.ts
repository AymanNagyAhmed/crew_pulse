import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { SyncOfflinePunchesDto } from './dto/sync-offline-punches.dto.js';
import { EdgeService } from './edge.service.js';

@Controller('edge')
export class EdgeController {
  constructor(private readonly edge: EdgeService) {}

  /**
   * Pull venue/shift roster for local edge eligibility cache (C10).
   * Returns worker ids + template counts only — never embedding vectors.
   */
  @Get('venues/:venueId/shifts/:shiftId/roster')
  @ResponseMessage('Edge roster snapshot')
  roster(
    @Param('venueId') venueId: string,
    @Param('shiftId') shiftId: string,
  ) {
    return this.edge.listRoster(venueId, shiftId);
  }

  /**
   * Upload offline punches after connectivity returns.
   * Idempotent on deviceEventId — server clock is payroll authority.
   */
  @Post('sync/punches')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Edge punches synced')
  syncPunches(@Body() dto: SyncOfflinePunchesDto) {
    return this.edge.syncOfflinePunches(dto);
  }

  @Get('punches/:deviceEventId')
  @ResponseMessage('Edge punch')
  getPunch(@Param('deviceEventId') deviceEventId: string) {
    return this.edge.getPunch(deviceEventId);
  }
}
