import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class PiiScrubberInterceptor implements NestInterceptor {
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'authorization',
    'token',
    'accesstoken',
    'refreshtoken',
    'cookie',
    'secret',
    'tokenhash',
    'creditcard',
    'cardnumber',
    'cvv',
    'ssn',
  ]);

  /**
   * Recursively sanitize sensitive keys from an object or payload
   */
  static scrub(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => PiiScrubberInterceptor.scrub(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
      if (PiiScrubberInterceptor.SENSITIVE_KEYS.has(normalizedKey)) {
        sanitized[key] = '[SCRUBBED]';
      } else if (typeof value === 'object') {
        sanitized[key] = PiiScrubberInterceptor.scrub(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => PiiScrubberInterceptor.scrub(data))
    );
  }
}
