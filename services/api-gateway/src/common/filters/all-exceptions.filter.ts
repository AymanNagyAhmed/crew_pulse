import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain.exception.js';
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
    if (exception instanceof DomainException) {
      return {
        success: false,
        statusCode: exception.statusCode,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        meta: { requestId },
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const { message, details } = this.normalizeHttpPayload(payload);

      if (statusCode >= 500) {
        return this.internal(requestId);
      }

      return {
        success: false,
        statusCode,
        error: {
          code: HttpStatus[statusCode] ?? 'HTTP_ERROR',
          message,
          details,
        },
        meta: { requestId },
      };
    }

    return this.internal(requestId);
  }

  private normalizeHttpPayload(payload: string | object): {
    message: string;
    details?: { field: string; issue: string }[];
  } {
    if (typeof payload === 'string') {
      return { message: payload };
    }

    const record = payload as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(record.message)) {
      return {
        message: 'Validation failed',
        details: record.message.map((issue) => ({
          field: 'body',
          issue: String(issue),
        })),
      };
    }

    return {
      message:
        (typeof record.message === 'string' && record.message) ||
        record.error ||
        'Request failed',
    };
  }

  private internal(requestId: string): ApiFailure {
    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'An unexpected error occurred. Our team has been notified.',
      },
      meta: { requestId },
    };
  }
}
