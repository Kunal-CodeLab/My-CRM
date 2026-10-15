import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiErrorResponse } from '@crm/shared-types';
import * as crypto from 'crypto';

@Catch()
export class Rfc7807ExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected internal server error occurred.';
    let type = 'https://api.crm.domain/errors/internal-server-error';
    let errors: Array<{ field: string; message: string }> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        detail = obj.message || obj.detail || exception.message;
        if (Array.isArray(obj.message)) {
          detail = 'Validation failed';
          errors = obj.message.map((msg: string) => ({
            field: 'request',
            message: msg,
          }));
        }
        if (obj.errors) {
          errors = obj.errors;
        }
      }

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          title = 'Bad Request';
          type = 'https://api.crm.domain/errors/bad-request';
          break;
        case HttpStatus.UNAUTHORIZED:
          title = 'Unauthorized';
          type = 'https://api.crm.domain/errors/unauthorized';
          break;
        case HttpStatus.FORBIDDEN:
          title = 'Forbidden';
          type = 'https://api.crm.domain/errors/forbidden';
          break;
        case HttpStatus.NOT_FOUND:
          title = 'Not Found';
          type = 'https://api.crm.domain/errors/not-found';
          break;
        case HttpStatus.CONFLICT:
          title = 'Conflict';
          type = 'https://api.crm.domain/errors/conflict';
          break;
        case HttpStatus.UNPROCESSABLE_ENTITY:
          title = 'Validation Failed';
          type = 'https://api.crm.domain/errors/validation-failed';
          break;
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
    }

    const traceId = (request.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;

    const problemEnvelope: ApiErrorResponse = {
      type,
      title,
      status,
      detail: Array.isArray(detail) ? detail.join(', ') : detail,
      instance: request.url || '',
      traceId,
      ...(errors ? { errors } : {}),
    };

    reply.status(status).send(problemEnvelope);
  }
}
