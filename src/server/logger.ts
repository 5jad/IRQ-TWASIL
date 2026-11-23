import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getEnv } from './env.ts';

export function redactUrlSecrets(rawUrl: string): string {
  return rawUrl
    .replace(/\/bot[^/?]+/gi, '/bot[REDACTED]')
    .replace(/(\+?964|00964|0)?7\d{9}/g, '[PHONE]')
    .replace(/([?&](token|code|otp|sig)=)[^&]+/gi, '$1[REDACTED]');
}

export function createLogger() {
  const env = getEnv();
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.body.phone',
        'req.body.code',
        'req.body.otp',
        'req.body.token',
        'req.body.secret',
        'phone',
        'code',
        'otp',
        'token',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

export const logger = createLogger();

export function createHttpLogger() {
  return pinoHttp({
    logger,
    genReqId(req: IncomingMessage, res: ServerResponse) {
      const existing = req.headers['x-request-id'];
      const id =
        typeof existing === 'string' && existing.trim().length > 0 && existing.length <= 128
          ? existing.trim()
          : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    serializers: {
      req(req) {
        return {
          id: (req as unknown as { id?: string }).id,
          method: req.method,
          url: redactUrlSecrets(req.url ?? ''),
          remoteAddress: req.remoteAddress,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}
