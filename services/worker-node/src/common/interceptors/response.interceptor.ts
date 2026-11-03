import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';
import type { ApiSuccess } from '../interfaces/api-response.interface.js';
import { resolveRequestId } from '../utils/request-id.js';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccess<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse<Response>();
    const requestId = resolveRequestId(req);
    res.setHeader('x-request-id', requestId);

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'OK';

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        statusCode: res.statusCode,
        message,
        data,
        meta: { requestId },
      })),
    );
  }
}
