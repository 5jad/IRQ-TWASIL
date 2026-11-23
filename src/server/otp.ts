import crypto from 'node:crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { otpChallengesTable } from '../db/schema.ts';
import { getEnv } from './env.ts';
import { maskE164Phone } from './dto.ts';
import { hmacPhone, normalizeDigitsToAscii, normalizePhoneToE164 } from './phone.ts';
import { logger } from './logger.ts';

export type OtpPurpose = 'login' | 'signup' | 'delete-account' | 'link-phone';

export interface OtpSender {
  sendOtp(e164Phone: string, code: string): Promise<void>;
}

let testOtpListener: ((e164Phone: string, code: string) => void) | null = null;

export function setTestOtpListener(listener: ((e164Phone: string, code: string) => void) | null): void {
  testOtpListener = listener;
}

class ConsoleOtpSender implements OtpSender {
  async sendOtp(e164Phone: string, code: string): Promise<void> {
    if (testOtpListener) {
      testOtpListener(e164Phone, code);
    }
    const env = getEnv();
    if (env.NODE_ENV === 'development') {
      logger.info(
        { maskedPhone: maskE164Phone(e164Phone), devOtpCode: code },
        'Dev OTP code generated'
      );
    }
  }
}

class GenericHttpOtpSender implements OtpSender {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async sendOtp(e164Phone: string, code: string): Promise<void> {
    if (testOtpListener) {
      testOtpListener(e164Phone, code);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          to: e164Phone,
          message: `رمز تواصل: ${code} لا تشاركه مع أحد.`,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`OTP gateway responded with ${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getOtpSender(): OtpSender {
  const env = getEnv();
  if (env.OTP_PROVIDER === 'generic-http' && env.OTP_HTTP_URL && env.OTP_HTTP_TOKEN) {
    return new GenericHttpOtpSender(env.OTP_HTTP_URL, env.OTP_HTTP_TOKEN);
  }
  return new ConsoleOtpSender();
}

export function hashOtpCode(challengeId: string, code: string): string {
  const env = getEnv();
  return crypto
    .createHmac('sha256', env.OTP_PEPPER)
    .update(`${challengeId}:${code}`)
    .digest('hex');
}

export function verifyOtpHashConstantTime(challengeId: string, code: string, storedHex: string): boolean {
  const candidateHex = hashOtpCode(challengeId, code);
  const a = Buffer.from(candidateHex, 'hex');
  const b = Buffer.from(storedHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export class OtpError extends Error {
  status: number;
  code: string;
  retryAfterSec?: number;
  constructor(status: number, code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.name = 'OtpError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export async function requestOtpChallenge(input: {
  rawPhone: string;
  purpose: OtpPurpose;
  ipAddress: string;
}): Promise<{ challengeId: string; e164: string; expiresInSec: number; resendAfterSec: number }> {
  let e164: string;
  try {
    e164 = normalizePhoneToE164(input.rawPhone);
  } catch {
    throw new OtpError(400, 'invalid_phone', 'رقم الهاتف غير صالح');
  }

  const pHmac = hmacPhone(e164);
  const db = getDb();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check 24-hour lockout on 3 failed challenges per phone per day
  const failedToday = await db
    .select({ id: otpChallengesTable.id, createdAt: otpChallengesTable.createdAt })
    .from(otpChallengesTable)
    .where(
      and(
        eq(otpChallengesTable.phoneHmac, pHmac),
        eq(otpChallengesTable.failedChallengeCounted, true),
        gte(otpChallengesTable.createdAt, oneDayAgo)
      )
    )
    .orderBy(desc(otpChallengesTable.createdAt));

  if (failedToday.length >= 3) {
    const oldestRelevant = failedToday[2]!.createdAt;
    const retryAfterSec = Math.max(1, Math.ceil((oldestRelevant.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / 1000));
    throw new OtpError(429, 'otp_locked', 'حاولت كثيراً، جرّب بعد ٢٤ ساعة', retryAfterSec);
  }

  // Check 60s resend cooldown and 5/phone/hour
  const recentPhoneChallenges = await db
    .select({ id: otpChallengesTable.id, createdAt: otpChallengesTable.createdAt })
    .from(otpChallengesTable)
    .where(and(eq(otpChallengesTable.phoneHmac, pHmac), gte(otpChallengesTable.createdAt, oneHourAgo)))
    .orderBy(desc(otpChallengesTable.createdAt));

  if (recentPhoneChallenges.length > 0) {
    const latest = recentPhoneChallenges[0]!;
    const elapsedSec = (now.getTime() - latest.createdAt.getTime()) / 1000;
    if (elapsedSec < 60) {
      const waitSec = Math.max(1, Math.ceil(60 - elapsedSec));
      throw new OtpError(
        429,
        'otp_cooldown',
        `يرجى الانتظار ${waitSec} ثانية قبل إعادة الإرسال`,
        waitSec
      );
    }
  }

  if (recentPhoneChallenges.length >= 5) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((recentPhoneChallenges[4]!.createdAt.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000)
    );
    throw new OtpError(429, 'rate_limited', 'طلبات كثيرة، جرّب بعد قليل', retryAfterSec);
  }

  // Check 20/IP/hour
  if (input.ipAddress) {
    const recentIp = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(otpChallengesTable)
      .where(
        and(
          eq(otpChallengesTable.ipAddress, input.ipAddress),
          gte(otpChallengesTable.createdAt, oneHourAgo)
        )
      );
    if ((recentIp[0]?.count ?? 0) >= 20) {
      throw new OtpError(429, 'rate_limited', 'طلبات كثيرة، جرّب بعد قليل', 3600);
    }
  }

  const challengeId = `otp-${crypto.randomUUID()}`;
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtpCode(challengeId, code);
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  await db.transaction(async (tx) => {
    // Invalidate any previous active challenge for this phone
    await tx
      .update(otpChallengesTable)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(otpChallengesTable.phoneHmac, pHmac),
          sql`${otpChallengesTable.consumedAt} IS NULL`,
          sql`${otpChallengesTable.invalidatedAt} IS NULL`
        )
      );

    await tx.insert(otpChallengesTable).values({
      id: challengeId,
      phoneHmac: pHmac,
      purpose: input.purpose,
      codeHash,
      attempts: 0,
      maxAttempts: 5,
      ipAddress: input.ipAddress,
      expiresAt,
    });
  });

  // Always execute delivery path consistently
  await getOtpSender().sendOtp(e164, code);

  return {
    challengeId,
    e164,
    expiresInSec: 300,
    resendAfterSec: 60,
  };
}

export async function verifyOtpChallenge(input: {
  challengeId: string;
  rawCode: string;
  expectedPurpose?: OtpPurpose;
}): Promise<{ phoneHmac: string; purpose: OtpPurpose }> {
  const code = normalizeDigitsToAscii(input.rawCode).trim();
  const db = getDb();
  const now = new Date();

  const [challenge] = await db
    .select()
    .from(otpChallengesTable)
    .where(eq(otpChallengesTable.id, input.challengeId))
    .limit(1);

  if (!challenge) {
    // Perform dummy HMAC to keep verification work constant-time
    verifyOtpHashConstantTime(input.challengeId, code, '0'.repeat(64));
    throw new OtpError(400, 'invalid_otp', 'رمز التحقق غير صحيح أو منتهي الصلاحية');
  }

  if (input.expectedPurpose && challenge.purpose !== input.expectedPurpose) {
    throw new OtpError(400, 'invalid_otp', 'رمز التحقق غير صالح لهذه العملية');
  }

  if (challenge.consumedAt || challenge.invalidatedAt) {
    throw new OtpError(400, 'otp_expired', 'رمز التحقق لم يعد صالحاً، اطلب رمزاً جديداً');
  }

  if (challenge.expiresAt.getTime() <= now.getTime()) {
    await db
      .update(otpChallengesTable)
      .set({ invalidatedAt: now, failedChallengeCounted: true })
      .where(eq(otpChallengesTable.id, challenge.id));
    throw new OtpError(400, 'otp_expired', 'انتهت صلاحية رمز التحقق');
  }

  const isMatch = verifyOtpHashConstantTime(challenge.id, code, challenge.codeHash);
  if (!isMatch) {
    const nextAttempts = challenge.attempts + 1;
    const exhausted = nextAttempts >= challenge.maxAttempts;
    await db
      .update(otpChallengesTable)
      .set({
        attempts: nextAttempts,
        ...(exhausted ? { invalidatedAt: now, failedChallengeCounted: true } : {}),
      })
      .where(eq(otpChallengesTable.id, challenge.id));

    if (exhausted) {
      // Check if this triggers the 3rd failed challenge today
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const failedToday = await db
        .select({ id: otpChallengesTable.id })
        .from(otpChallengesTable)
        .where(
          and(
            eq(otpChallengesTable.phoneHmac, challenge.phoneHmac),
            eq(otpChallengesTable.failedChallengeCounted, true),
            gte(otpChallengesTable.createdAt, oneDayAgo)
          )
        );
      if (failedToday.length >= 3) {
        throw new OtpError(429, 'otp_locked', 'حاولت كثيراً، جرّب بعد ٢٤ ساعة', 86400);
      }
      throw new OtpError(400, 'otp_exhausted', 'تم تجاوز عدد المحاولات المسموح، اطلب رمزاً جديداً');
    }

    throw new OtpError(400, 'invalid_otp', 'رمز التحقق غير صحيح');
  }

  await db
    .update(otpChallengesTable)
    .set({ consumedAt: now })
    .where(eq(otpChallengesTable.id, challenge.id));

  return {
    phoneHmac: challenge.phoneHmac,
    purpose: challenge.purpose as OtpPurpose,
  };
}
