import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return {
      service: 'api-gateway',
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };
  }
}
