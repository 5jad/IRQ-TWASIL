import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import rateLimit, { type Store, type IncrementResponse } from 'express-rate-limit';
import { sql } from 'drizzle-orm';
import { getDb, hasDatabaseConfig } from '../db/index.ts';
import { rateLimitsTable } from '../db/schema.ts';
import type { AuthenticatedRequest } from './auth.ts';
import { sendApiError } from './schemas.ts';

export class PostgresRateLimitStore implements Store {
  windowMs: number;
  prefix: string;

  constructor(windowMs: number, prefix: string) {
    this.windowMs = windowMs;
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private fullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (!hasDatabaseConfig()) {
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + this.windowMs),
      };
    }

    const db = getDb();
    const fk = this.fullKey(key);
    const nextReset = new Date(Date.now() + this.windowMs);

    const res = await db.execute<{ count: number; reset_at: Date | string }>(sql`
      INSERT INTO tw_rate_limits (key, count, reset_at)
      VALUES (${fk}, 1, ${nextReset})
      ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN tw_rate_limits.reset_at <= NOW() THEN 1
          ELSE tw_rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN tw_rate_limits.reset_at <= NOW() THEN ${nextReset}
          ELSE tw_rate_limits.reset_at
        END
      RETURNING count, reset_at
    `);

    const row = res.rows[0];
    const totalHits = Number(row?.count ?? 1);
    const resetTime = row?.reset_at ? new Date(row.reset_at) : nextReset;
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    if (!hasDatabaseConfig()) return;
    const db = getDb();
    const fk = this.fullKey(key);
    await db
      .update(rateLimitsTable)
      .set({ count: sql`GREATEST(0, ${rateLimitsTable.count} - 1)` })
      .where(sql`${rateLimitsTable.key} = ${fk}`);
  }

  async resetKey(key: string): Promise<void> {
    if (!hasDatabaseConfig()) return;
    const db = getDb();
    const fk = this.fullKey(key);
    await db.delete(rateLimitsTable).where(sql`${rateLimitsTable.key} = ${fk}`);
  }
}

export function isNewAccount(req: Request): boolean {
  const authReq = req as AuthenticatedRequest;
  const createdAt = authReq.auth?.userRow?.createdAt;
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() < 24 * 60 * 60 * 1000;
}

function makeKey(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.auth?.userId) {
    return `u:${authReq.auth.userId}`;
  }
  return `ip:${req.ip || 'unknown'}`;
}

export function createPgRateLimiter(options: {
  prefix: string;
  windowMs: number;
  limit: number;
  halveForNewAccounts?: boolean;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: (req: Request) => {
      if (options.halveForNewAccounts && isNewAccount(req)) {
        return Math.max(1, Math.floor(options.limit / 2));
      }
      return options.limit;
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: options.keyGenerator ?? makeKey,
    skip: options.skip,
    store: new PostgresRateLimitStore(options.windowMs, options.prefix),
    handler: (_req: Request, res: Response) => {
      const headerVal = res.getHeader('Retry-After');
      const retryAfterSec =
        typeof headerVal === 'string' || typeof headerVal === 'number'
          ? Math.max(1, Math.ceil(Number(headerVal)))
          : Math.max(1, Math.ceil(options.windowMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      sendApiError(res, 429, 'rate_limited', 'طلبات كثيرة، جرّب بعد قليل', {
        retryAfterSec,
      });
    },
  });
}

// 1. Auth OTP Request
export const authOtpRequestLimiter = createPgRateLimiter({
  prefix: 'rl:otp_req',
  windowMs: 60 * 1000,
  limit: 40,
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

// 2. Auth OTP Verify
export const authOtpVerifyLimiter = createPgRateLimiter({
  prefix: 'rl:otp_ver',
  windowMs: 60 * 1000,
  limit: 45,
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

// 3. Auth Signup & Handle Check
export const authSignupLimiter = createPgRateLimiter({
  prefix: 'rl:signup',
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

// 4. Media Uploads (halved for <24h accounts)
export const mediaUploadLimiter = createPgRateLimiter({
  prefix: 'rl:media',
  windowMs: 10 * 60 * 1000,
  limit: 30,
  halveForNewAccounts: true,
});

// 5. Content Writes (posts, stories, comments, polls, communities; halved for <24h accounts)
export const contentWriteLimiter = createPgRateLimiter({
  prefix: 'rl:content',
  windowMs: 5 * 60 * 1000,
  limit: 30,
  halveForNewAccounts: true,
});

// 6. Chat Messages & Starts (halved for <24h accounts)
export const chatWriteLimiter = createPgRateLimiter({
  prefix: 'rl:chat',
  windowMs: 60 * 1000,
  limit: 60,
  halveForNewAccounts: true,
});

// 7. Social Interactions & Reports (follows, likes, saves, reports; halved for <24h accounts)
export const socialActionLimiter = createPgRateLimiter({
  prefix: 'rl:social',
  windowMs: 60 * 1000,
  limit: 60,
  halveForNewAccounts: true,
});

// 8. Global API fallback
export const globalApiLimiter = createPgRateLimiter({
  prefix: 'rl:global',
  windowMs: 60 * 1000,
  limit: 300,
  skip: (req) =>
    req.path === '/api/health' ||
    req.path === '/api/ready' ||
    req.path === '/api/events' ||
    req.path.startsWith('/api/bot/') ||
    req.path.startsWith('/bot'),
});

// Duplicate spam check: reject identical normalized text 3 times within 10 minutes
export async function checkDuplicateSpam(userId: string, rawText: string | undefined): Promise<void> {
  if (!rawText || !hasDatabaseConfig()) return;
  const normalized = rawText.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalized.length < 4) return;

  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 20);
  const store = new PostgresRateLimitStore(10 * 60 * 1000, 'dup');
  const { totalHits, resetTime } = await store.increment(`${userId}:${hash}`);
  if (totalHits >= 3) {
    const retryAfterSec = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 600;
    const err = new Error('يرجى عدم تكرار نفس المحتوى بشكل متتالي') as Error & {
      status?: number;
      code?: string;
      retryAfterSec?: number;
    };
    err.status = 429;
    err.code = 'duplicate_spam';
    err.retryAfterSec = retryAfterSec;
    throw err;
  }
}

export function duplicateSpamMiddleware(textExtractor: (req: Request) => string | undefined) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.auth) {
        next();
        return;
      }
      await checkDuplicateSpam(authReq.auth.userId, textExtractor(req));
      next();
    } catch (err) {
      const e = err as { status?: number; code?: string; message?: string; retryAfterSec?: number };
      if (e.status === 429) {
        if (e.retryAfterSec) res.setHeader('Retry-After', String(e.retryAfterSec));
        sendApiError(res, 429, e.code ?? 'duplicate_spam', e.message ?? 'محتوى مكرر', {
          retryAfterSec: e.retryAfterSec,
        });
        return;
      }
      next(err);
    }
  };
}
