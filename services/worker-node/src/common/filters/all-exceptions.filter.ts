import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiFailure } from '../interfaces/api-response.interface.js';
import { resolveRequestId } from '../utils/request-id.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = resolveRequestId(req);
    res.setHeader('x-request-id', requestId);

    const body = this.toFailure(exception, requestId);
    if (body.statusCode >= 500) {
      this.logger.error(
        { requestId, err: exception },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    res.status(body.statusCode).json(body);
  }

  private toFailure(exception: unknown, requestId: string): ApiFailure {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            exception.message);
      return {
        success: false,
        statusCode: status,
        error: {
          code: HttpStatus[status] ?? 'HTTP_ERROR',
          message: Array.isArray(message) ? message.join('; ') : String(message),
        },
        meta: { requestId },
      };
    }

    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
      meta: { requestId },
    };
  }
}
