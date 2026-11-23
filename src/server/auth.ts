import crypto from 'node:crypto';
import type { Request, Response, NextFunction, Express } from 'express';
import { and, eq, or, sql } from 'drizzle-orm';
import { getDb, hasDatabaseConfig } from '../db/index.ts';
import { otpChallengesTable, sessionsTable, usersTable } from '../db/schema.ts';
import { getEnv } from './env.ts';
import { decryptPhone, encryptPhone, hmacPhone, normalizePhoneToE164, validateHandle } from './phone.ts';
import { OtpError, requestOtpChallenge, verifyOtpChallenge } from './otp.ts';
import { hashPassword, verifyPassword } from './password.ts';
import {
  ChangePasswordSchema,
  DeleteAccountSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  PasswordLoginSchema,
  RequestPhoneLinkSchema,
  SetEmailSchema,
  SignupSchema,
  VerifyPhoneLinkSchema,
  sendApiError,
  validateBody,
} from './schemas.ts';
import { maskE164Phone, parseUserSettings, toSelfUser, type SelfUserDto } from './dto.ts';
import { shouldRequireTwoFactorLogin } from '../lib/visibility.ts';

export interface AuthSessionContext {
  sessionId: string;
  userId: string;
  role: 'user' | 'moderator' | 'admin';
  userRow: typeof usersTable.$inferSelect;
  decryptedPhone: string | null;
}

export type AuthenticatedRequest = Request & {
  auth?: AuthSessionContext;
  authUserId?: string;
};

const SLIDING_DAYS = 30;
const ABSOLUTE_DAYS = 90;
const ROTATION_MS = 24 * 60 * 60 * 1000;

// Short-lived in-memory map for pending signup phone encryption keyed by random challenge/signup token
// (Also signed via HMAC so stateless across restarts except encrypted phone carried cleanly inside token)
interface SignupTokenPayload {
  phoneEnc: string;
  phoneHmac: string;
  exp: number;
}

export function getSessionCookieName(): string {
  const env = getEnv();
  return env.NODE_ENV === 'production' && env.APP_URL.startsWith('https://')
    ? '__Host-tw_session'
    : 'tw_session';
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function signSignupToken(payload: SignupTokenPayload): string {
  const env = getEnv();
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySignupToken(token: string): SignupTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  const env = getEnv();
  const expected = crypto.createHmac('sha256', env.SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SignupTokenPayload;
    if (
      typeof parsed.phoneEnc !== 'string' ||
      typeof parsed.phoneHmac !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function deriveDeviceLabel(ua: string | undefined): string {
  if (!ua) return 'متصفح ويب';
  if (/iPhone|iPad/i.test(ua)) return 'Safari على iOS';
  if (/Android/i.test(ua)) return 'متصفح Android';
  if (/Mac OS/i.test(ua)) return 'متصفح macOS';
  if (/Windows/i.test(ua)) return 'متصفح Windows';
  if (/Linux/i.test(ua)) return 'متصفح Linux';
  return 'متصفح ويب';
}

function isHttpsRequest(req?: Request): boolean {
  const env = getEnv();
  if (env.APP_URL.startsWith('https://')) return true;
  if (!req) return false;
  if (req.secure) return true;
  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string' && xfProto.split(',')[0]?.trim().toLowerCase() === 'https') {
    return true;
  }
  return false;
}

export function setSessionCookie(res: Response, rawToken: string, expiresAt: Date, req?: Request): void {
  const cookieName = getSessionCookieName();
  const isSecure = isHttpsRequest(req);
  const parts = [
    `${cookieName}=${encodeURIComponent(rawToken)}`,
    'HttpOnly',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const cookieName = getSessionCookieName();
  const isSecure = isHttpsRequest(req);
  const parts = [
    `${cookieName}=`,
    'HttpOnly',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function createSessionForUser(
  req: Request,
  res: Response,
  userId: string
): Promise<{ sessionId: string; rawToken: string }> {
  const db = getDb();
  const now = new Date();
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const sessionId = `sess-${crypto.randomUUID()}`;
  const expiresAt = new Date(now.getTime() + SLIDING_DAYS * 24 * 60 * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_DAYS * 24 * 60 * 60 * 1000);
  const ua = req.headers['user-agent'];

  await db.insert(sessionsTable).values({
    id: sessionId,
    userId,
    tokenHash,
    deviceLabel: deriveDeviceLabel(ua),
    ipAddress: req.ip ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, 250) : null,
    createdAt: now,
    lastRotatedAt: now,
    lastActiveAt: now,
    expiresAt,
    absoluteExpiresAt,
  });

  setSessionCookie(res, rawToken, expiresAt, req);
  return { sessionId, rawToken };
}

export async function attachSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!hasDatabaseConfig()) {
    next();
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieName = getSessionCookieName();
  const cookieToken = cookies[cookieName] ?? cookies['tw_session'] ?? cookies['__Host-tw_session'];
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
  const rawToken = cookieToken || bearerToken;
  if (!rawToken) {
    next();
    return;
  }

  try {
    const db = getDb();
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();

    const rows = await db
      .select({
        session: sessionsTable,
        user: usersTable,
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(eq(sessionsTable.tokenHash, tokenHash))
      .limit(1);

    const row = rows[0];
    if (!row) {
      next();
      return;
    }

    const { session, user } = row;
    if (
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime() ||
      session.absoluteExpiresAt.getTime() <= now.getTime() ||
      user.status !== 'active'
    ) {
      clearSessionCookie(res, req);
      next();
      return;
    }

    // Rotate token if > 24h since last rotation
    const shouldRotate = now.getTime() - session.lastRotatedAt.getTime() >= ROTATION_MS;
    const nextSlidingExpiry = new Date(
      Math.min(
        session.absoluteExpiresAt.getTime(),
        now.getTime() + SLIDING_DAYS * 24 * 60 * 60 * 1000
      )
    );

    if (shouldRotate) {
      const nextRawToken = crypto.randomBytes(32).toString('base64url');
      const nextHash = hashSessionToken(nextRawToken);
      await db
        .update(sessionsTable)
        .set({
          tokenHash: nextHash,
          lastRotatedAt: now,
          lastActiveAt: now,
          expiresAt: nextSlidingExpiry,
        })
        .where(eq(sessionsTable.id, session.id));
      setSessionCookie(res, nextRawToken, nextSlidingExpiry, req);
      if (!cookieToken && bearerToken) {
        res.setHeader('X-TW-Session-Token', nextRawToken);
      }
    } else if (now.getTime() - session.lastActiveAt.getTime() > 5 * 60 * 1000) {
      await db
        .update(sessionsTable)
        .set({ lastActiveAt: now, expiresAt: nextSlidingExpiry })
        .where(eq(sessionsTable.id, session.id));
    }

    const authReq = req as AuthenticatedRequest;
    authReq.authUserId = user.id;
    authReq.auth = {
      sessionId: session.id,
      userId: user.id,
      role: (user.role as 'user' | 'moderator' | 'admin') ?? 'user',
      userRow: user,
      decryptedPhone: decryptPhone(user.phoneEnc),
    };
  } catch {
    // Let DB error middleware or downstream routes handle DB outages
  }

  next();
}

export function csrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  // Bot API uses Authorization: Bot <token>, not cookies
  if (req.path.startsWith('/api/bot/') || req.path.startsWith('/bot')) {
    next();
    return;
  }

  // Local dev signed PUT upload uses its own HMAC signature
  if (req.path.startsWith('/uploads/')) {
    next();
    return;
  }

  if (!req.path.startsWith('/api/')) {
    next();
    return;
  }

  const csrfHeader = req.headers['x-tw-csrf'];
  if (csrfHeader !== '1') {
    sendApiError(res, 403, 'csrf_failed', 'فشل التحقق من أمان الطلب (CSRF)');
    return;
  }

  const env = getEnv();
  const appOrigin = new URL(env.APP_URL).origin;
  const allowedOrigins = new Set([
    appOrigin,
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    ...env.ALLOWED_ORIGINS,
  ]);
  const hostOrigin = req.headers.host ? `${req.protocol}://${req.headers.host}` : null;
  if (hostOrigin) allowedOrigins.add(hostOrigin);

  const origin = req.headers.origin;
  if (typeof origin === 'string' && !allowedOrigins.has(origin)) {
    sendApiError(res, 403, 'csrf_origin_denied', 'مصدر الطلب غير مسموح به');
    return;
  }

  if (!origin && typeof req.headers.referer === 'string') {
    try {
      const refOrigin = new URL(req.headers.referer).origin;
      if (!allowedOrigins.has(refOrigin)) {
        sendApiError(res, 403, 'csrf_origin_denied', 'مرجع الطلب غير مسموح به');
        return;
      }
    } catch {
      sendApiError(res, 403, 'csrf_origin_denied', 'مرجع الطلب غير صالح');
      return;
    }
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    sendApiError(res, 401, 'unauthorized', 'يرجى تسجيل الدخول للمتابعة');
    return;
  }
  next();
}

export function requireRole(...roles: Array<'user' | 'moderator' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.auth) {
      sendApiError(res, 401, 'unauthorized', 'يرجى تسجيل الدخول للمتابعة');
      return;
    }
    if (!roles.includes(authReq.auth.role)) {
      sendApiError(res, 403, 'forbidden', 'غير مصرّح بالدخول');
      return;
    }
    next();
  };
}

// Temporary store linking challengeId -> encrypted phone for signup flow (avoids exposing phone in client)
const pendingPhoneByChallenge = new Map<string, { phoneEnc: string; expiresAt: number }>();

function prunePendingPhones(): void {
  const now = Date.now();
  for (const [k, v] of pendingPhoneByChallenge.entries()) {
    if (v.expiresAt <= now) pendingPhoneByChallenge.delete(k);
  }
}

export function registerAuthRoutes(app: Express): void {
  app.post(
    '/api/auth/otp/request',
    validateBody(OtpRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { phone, purpose } = req.body as { phone: string; purpose: 'login' | 'signup' | 'delete-account' };

        if (purpose === 'delete-account') {
          const authReq = req as AuthenticatedRequest;
          if (!authReq.auth) {
            sendApiError(res, 401, 'unauthorized', 'يرجى تسجيل الدخول للمتابعة');
            return;
          }
          const e164 = normalizePhoneToE164(phone);
          if (hmacPhone(e164) !== authReq.auth.userRow.phoneHmac) {
            sendApiError(res, 403, 'phone_mismatch', 'رقم الهاتف لا يطابق حسابك الحالي');
            return;
          }
        }

        const result = await requestOtpChallenge({
          rawPhone: phone,
          purpose,
          ipAddress: req.ip ?? '',
        });

        prunePendingPhones();
        pendingPhoneByChallenge.set(result.challengeId, {
          phoneEnc: encryptPhone(result.e164),
          expiresAt: Date.now() + 15 * 60 * 1000,
        });

        res.status(200).json({
          challengeId: result.challengeId,
          expiresInSec: result.expiresInSec,
          resendAfterSec: result.resendAfterSec,
        });
      } catch (err) {
        if (err instanceof OtpError) {
          if (err.retryAfterSec) {
            res.setHeader('Retry-After', String(err.retryAfterSec));
          }
          sendApiError(res, err.status, err.code, err.message, {
            retryAfterSec: err.retryAfterSec,
          });
          return;
        }
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/otp/verify',
    validateBody(OtpVerifySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { challengeId, code } = req.body as { challengeId: string; code: string };
        const verified = await verifyOtpChallenge({ challengeId, rawCode: code });

        const db = getDb();
        const [existingUser] = await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.phoneHmac, verified.phoneHmac),
              sql`${usersTable.status} <> 'deleted'`
            )
          )
          .limit(1);

        if (existingUser) {
          if (existingUser.status === 'suspended') {
            sendApiError(res, 403, 'account_suspended', 'تم تعليق هذا الحساب لمخالفة الإرشادات');
            return;
          }
          await db
            .update(usersTable)
            .set({ lastSeenAt: new Date(), phoneVerifiedAt: existingUser.phoneVerifiedAt ?? new Date() })
            .where(eq(usersTable.id, existingUser.id));

          const { rawToken } = await createSessionForUser(req, res, existingUser.id);
          const selfUser: SelfUserDto = toSelfUser(
            existingUser,
            {},
            decryptPhone(existingUser.phoneEnc)
          );
          res.json({ status: 'authenticated', user: selfUser, sessionToken: rawToken });
          return;
        }

        const pending = pendingPhoneByChallenge.get(challengeId);
        if (!pending) {
          sendApiError(res, 400, 'signup_expired', 'انتهت جلسة التحقق، اطلب رمزاً جديداً');
          return;
        }
        pendingPhoneByChallenge.delete(challengeId);

        const signupToken = signSignupToken({
          phoneEnc: pending.phoneEnc,
          phoneHmac: verified.phoneHmac,
          exp: Date.now() + 15 * 60 * 1000,
        });

        res.json({ status: 'needs_signup', signupToken });
      } catch (err) {
        if (err instanceof OtpError) {
          if (err.retryAfterSec) {
            res.setHeader('Retry-After', String(err.retryAfterSec));
          }
          sendApiError(res, err.status, err.code, err.message, {
            retryAfterSec: err.retryAfterSec,
          });
          return;
        }
        next(err);
      }
    }
  );

  app.get('/api/auth/handle-available', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = String(req.query.handle ?? '');
      const check = validateHandle(raw);
      if (!check.ok) {
        res.json({ available: false, message: check.message });
        return;
      }
      const db = getDb();
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(or(eq(usersTable.handle, check.handle), eq(usersTable.username, check.handle)))
        .limit(1);

      res.json({
        available: !existing,
        handle: check.handle,
        message: existing ? 'اسم المستخدم هذا محجوز بالفعل' : 'اسم المستخدم متاح',
      });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/auth/signup',
    validateBody(SignupSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as {
          signupToken: string;
          handle: string;
          displayName: string;
          province: string;
          birthYear: number;
          accountType: 'personal' | 'creator' | 'merchant';
          password?: string;
          acceptedTerms: true;
        };

        const tokenPayload = verifySignupToken(body.signupToken);
        if (!tokenPayload) {
          sendApiError(res, 400, 'invalid_signup_token', 'انتهت صلاحية التسجيل، أعد التحقق من رقمك');
          return;
        }

        const currentYear = new Date().getUTCFullYear();
        const age = currentYear - body.birthYear;
        if (age < 13) {
          sendApiError(res, 400, 'under_age', 'الحد الأدنى للعمر هو ١٣ سنة');
          return;
        }

        const handleCheck = validateHandle(body.handle);
        if (!handleCheck.ok) {
          sendApiError(res, 400, 'invalid_handle', handleCheck.message);
          return;
        }

        const db = getDb();
        const [dup] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            or(
              eq(usersTable.handle, handleCheck.handle),
              eq(usersTable.username, handleCheck.handle),
              eq(usersTable.phoneHmac, tokenPayload.phoneHmac)
            )
          )
          .limit(1);

        if (dup) {
          sendApiError(res, 409, 'account_conflict', 'اسم المستخدم أو رقم الهاتف مسجل مسبقاً');
          return;
        }

        const now = new Date();
        const userId = `u-${crypto.randomUUID().slice(0, 12)}`;
        const safeAccountType = age < 18 ? 'personal' : body.accountType;
        const passwordHash = body.password ? hashPassword(body.password) : null;

        const [created] = await db
          .insert(usersTable)
          .values({
            id: userId,
            username: handleCheck.handle,
            handle: handleCheck.handle,
            phoneEnc: tokenPayload.phoneEnc,
            phoneHmac: tokenPayload.phoneHmac,
            phoneVerifiedAt: now,
            passwordHash,
            displayName: body.displayName,
            avatarUrl: '',
            bio: '',
            province: body.province,
            isVerified: false,
            verifiedKind: 'none',
            accountType: safeAccountType,
            role: 'user',
            kind: 'person',
            status: 'active',
            birthYear: body.birthYear,
            lastSeenAt: now,
            sortOrder: 100,
          })
          .returning();

        const { rawToken } = await createSessionForUser(req, res, created!.id);

        res.status(201).json({
          status: 'authenticated',
          user: toSelfUser(created!, {}, decryptPhone(created!.phoneEnc)),
          sessionToken: rawToken,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/password-login',
    validateBody(PasswordLoginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { identifier, password } = req.body as { identifier: string; password: string };
        const db = getDb();

        let targetUser: typeof usersTable.$inferSelect | undefined;
        let phoneLookupHmac: string | null = null;
        try {
          const e164 = normalizePhoneToE164(identifier);
          phoneLookupHmac = hmacPhone(e164);
        } catch {
          phoneLookupHmac = null;
        }

        if (phoneLookupHmac) {
          const [byPhone] = await db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.phoneHmac, phoneLookupHmac),
                sql`${usersTable.status} <> 'deleted'`
              )
            )
            .limit(1);
          targetUser = byPhone;
        } else {
          const rawTrimmed = identifier.trim();
          const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawTrimmed);
          if (isEmailInput) {
            const emailNorm = rawTrimmed.toLowerCase();
            const [byEmail] = await db
              .select()
              .from(usersTable)
              .where(
                and(
                  sql`lower(${usersTable.email}) = ${emailNorm}`,
                  sql`${usersTable.status} <> 'deleted'`
                )
              )
              .limit(1);
            targetUser = byEmail;
          } else {
            const handleNorm = rawTrimmed.replace(/^@+/, '').toLowerCase();
            if (handleNorm) {
              const [byHandle] = await db
                .select()
                .from(usersTable)
                .where(
                  and(
                    or(eq(usersTable.handle, handleNorm), eq(usersTable.username, handleNorm)),
                    sql`${usersTable.status} <> 'deleted'`
                  )
                )
                .limit(1);
              targetUser = byHandle;
            }
          }
        }

        if (!targetUser || !verifyPassword(password, targetUser.passwordHash)) {
          sendApiError(res, 401, 'invalid_credentials', 'رقم الهاتف أو البريد أو كلمة المرور غير صحيحة');
          return;
        }

        if (targetUser.status === 'suspended') {
          sendApiError(res, 403, 'account_suspended', 'تم تعليق هذا الحساب لمخالفة الإرشادات');
          return;
        }

        const userSettings = parseUserSettings(targetUser.settingsJson);
        if (
          shouldRequireTwoFactorLogin({
            twoFactorEnabled: userSettings.twoFactorEnabled,
            phoneHmac: targetUser.phoneHmac,
            phoneEnc: targetUser.phoneEnc,
          })
        ) {
          const decryptedPhone = decryptPhone(targetUser.phoneEnc);
          if (decryptedPhone) {
            try {
              const otpRes = await requestOtpChallenge({
                rawPhone: decryptedPhone,
                purpose: 'login',
                ipAddress: req.ip ?? '',
              });
              res.json({
                status: 'two_factor_required',
                challengeId: otpRes.challengeId,
                maskedPhone: maskE164Phone(otpRes.e164),
                expiresInSec: otpRes.expiresInSec,
                resendAfterSec: otpRes.resendAfterSec,
              });
              return;
            } catch (otpErr) {
              if (otpErr instanceof OtpError) {
                if (otpErr.retryAfterSec) {
                  res.setHeader('Retry-After', String(otpErr.retryAfterSec));
                }
                sendApiError(res, otpErr.status, otpErr.code, otpErr.message, {
                  retryAfterSec: otpErr.retryAfterSec,
                });
                return;
              }
              throw otpErr;
            }
          }
        }

        await db
          .update(usersTable)
          .set({ lastSeenAt: new Date() })
          .where(eq(usersTable.id, targetUser.id));

        const { rawToken } = await createSessionForUser(req, res, targetUser.id);
        const selfUser: SelfUserDto = toSelfUser(
          targetUser,
          {},
          decryptPhone(targetUser.phoneEnc)
        );
        res.json({ status: 'authenticated', user: selfUser, sessionToken: rawToken });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get('/api/auth/session', (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.auth) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({
      authenticated: true,
      user: toSelfUser(authReq.auth.userRow, {}, authReq.auth.decryptedPhone),
    });
  });

  app.post('/api/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (authReq.auth) {
        const db = getDb();
        await db
          .update(sessionsTable)
          .set({ revokedAt: new Date() })
          .where(eq(sessionsTable.id, authReq.auth.sessionId));
      }
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout-all', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      await db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(eq(sessionsTable.userId, authReq.auth!.userId));
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/devices', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select()
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.userId, authReq.auth!.userId),
            sql`${sessionsTable.revokedAt} IS NULL`
          )
        );

      const devices = rows
        .filter((s) => s.expiresAt.getTime() > now.getTime())
        .map((s) => ({
          id: s.id,
          deviceLabel: s.deviceLabel,
          ipAddress: s.ipAddress ?? undefined,
          createdAt: s.createdAt.toISOString(),
          lastActiveAt: s.lastActiveAt.toISOString(),
          isCurrent: s.id === authReq.auth!.sessionId,
        }));

      res.json({ devices });
    } catch (err) {
      next(err);
    }
  });

  app.delete(
    '/api/auth/devices/:sessionId',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const sessionId = String(req.params.sessionId);
        const db = getDb();
        const [target] = await db
          .select()
          .from(sessionsTable)
          .where(eq(sessionsTable.id, sessionId))
          .limit(1);

        if (!target || target.userId !== authReq.auth!.userId) {
          sendApiError(res, 404, 'not_found', 'الجلسة غير موجودة');
          return;
        }

        await db
          .update(sessionsTable)
          .set({ revokedAt: new Date() })
          .where(eq(sessionsTable.id, sessionId));

        if (sessionId === authReq.auth!.sessionId) {
          clearSessionCookie(res);
        }

        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/email',
    requireAuth,
    validateBody(SetEmailSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { email, currentPassword } = req.body as {
          email: string;
          currentPassword?: string;
        };
        const userRow = authReq.auth!.userRow;
        if (userRow.passwordHash && !verifyPassword(currentPassword ?? '', userRow.passwordHash)) {
          sendApiError(res, 401, 'invalid_password', 'كلمة المرور الحالية غير صحيحة');
          return;
        }
        const emailNorm = email.trim().toLowerCase();
        const db = getDb();
        const [dup] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              sql`lower(${usersTable.email}) = ${emailNorm}`,
              sql`${usersTable.id} <> ${authReq.auth!.userId}`,
              sql`${usersTable.status} <> 'deleted'`
            )
          )
          .limit(1);
        if (dup) {
          sendApiError(res, 409, 'email_taken', 'هذا البريد الإلكتروني مرتبط بحساب آخر بالفعل');
          return;
        }

        await db
          .update(usersTable)
          .set({ email: emailNorm })
          .where(eq(usersTable.id, authReq.auth!.userId));

        res.json({ ok: true, email: emailNorm });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/password',
    requireAuth,
    validateBody(ChangePasswordSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { currentPassword, newPassword } = req.body as {
          currentPassword?: string;
          newPassword: string;
        };
        const userRow = authReq.auth!.userRow;
        if (userRow.passwordHash && !verifyPassword(currentPassword ?? '', userRow.passwordHash)) {
          sendApiError(res, 401, 'invalid_password', 'كلمة المرور الحالية غير صحيحة');
          return;
        }

        const db = getDb();
        await db
          .update(usersTable)
          .set({ passwordHash: hashPassword(newPassword) })
          .where(eq(usersTable.id, authReq.auth!.userId));

        res.json({ ok: true, hasPassword: true });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/phone/request-link',
    requireAuth,
    validateBody(RequestPhoneLinkSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { phone } = req.body as { phone: string };
        let e164: string;
        try {
          e164 = normalizePhoneToE164(phone);
        } catch {
          sendApiError(res, 400, 'invalid_phone', 'رقم الهاتف غير صالح');
          return;
        }
        const phoneHmac = hmacPhone(e164);
        const db = getDb();
        const [dup] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.phoneHmac, phoneHmac),
              sql`${usersTable.id} <> ${authReq.auth!.userId}`,
              sql`${usersTable.status} <> 'deleted'`
            )
          )
          .limit(1);

        if (dup) {
          sendApiError(res, 409, 'phone_taken', 'رقم الهاتف مرتبط بحساب آخر بالفعل');
          return;
        }

        const result = await requestOtpChallenge({
          rawPhone: phone,
          purpose: 'link-phone',
          ipAddress: req.ip ?? '',
        });

        prunePendingPhones();
        pendingPhoneByChallenge.set(result.challengeId, {
          phoneEnc: encryptPhone(result.e164),
          expiresAt: Date.now() + 15 * 60 * 1000,
        });

        res.status(200).json({
          challengeId: result.challengeId,
          expiresInSec: result.expiresInSec,
          resendAfterSec: result.resendAfterSec,
        });
      } catch (err) {
        if (err instanceof OtpError) {
          if (err.retryAfterSec) res.setHeader('Retry-After', String(err.retryAfterSec));
          sendApiError(res, err.status, err.code, err.message, {
            retryAfterSec: err.retryAfterSec,
          });
          return;
        }
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/phone/verify-link',
    requireAuth,
    validateBody(VerifyPhoneLinkSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { challengeId, code } = req.body as { challengeId: string; code: string };
        const verified = await verifyOtpChallenge({
          challengeId,
          rawCode: code,
          expectedPurpose: 'link-phone',
        });

        const pending = pendingPhoneByChallenge.get(challengeId);
        if (!pending) {
          sendApiError(res, 400, 'otp_expired', 'انتهت جلسة ربط الرقم، اطلب رمزاً جديداً');
          return;
        }
        pendingPhoneByChallenge.delete(challengeId);

        const db = getDb();
        const [dup] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.phoneHmac, verified.phoneHmac),
              sql`${usersTable.id} <> ${authReq.auth!.userId}`,
              sql`${usersTable.status} <> 'deleted'`
            )
          )
          .limit(1);
        if (dup) {
          sendApiError(res, 409, 'phone_taken', 'رقم الهاتف مرتبط بحساب آخر بالفعل');
          return;
        }

        const now = new Date();
        await db
          .update(usersTable)
          .set({
            phoneEnc: pending.phoneEnc,
            phoneHmac: verified.phoneHmac,
            phoneVerifiedAt: now,
          })
          .where(eq(usersTable.id, authReq.auth!.userId));

        const decrypted = decryptPhone(pending.phoneEnc);
        res.json({
          ok: true,
          maskedPhone: decrypted ? maskE164Phone(decrypted) : undefined,
          phoneVerifiedAt: now.toISOString(),
        });
      } catch (err) {
        if (err instanceof OtpError) {
          if (err.retryAfterSec) res.setHeader('Retry-After', String(err.retryAfterSec));
          sendApiError(res, err.status, err.code, err.message, {
            retryAfterSec: err.retryAfterSec,
          });
          return;
        }
        next(err);
      }
    }
  );

  app.delete(
    '/api/auth/account',
    requireAuth,
    validateBody(DeleteAccountSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const body = req.body as
          | { challengeId: string; code: string }
          | { password: string };

        if ('password' in body) {
          if (!authReq.auth!.userRow.passwordHash || !verifyPassword(body.password, authReq.auth!.userRow.passwordHash)) {
            sendApiError(res, 401, 'invalid_password', 'كلمة المرور غير صحيحة');
            return;
          }
        } else {
          const verified = await verifyOtpChallenge({
            challengeId: body.challengeId,
            rawCode: body.code,
            expectedPurpose: 'delete-account',
          });

          if (verified.phoneHmac !== authReq.auth!.userRow.phoneHmac) {
            sendApiError(res, 403, 'forbidden', 'الرمز لا يخص هذا الحساب');
            return;
          }
        }

        const db = getDb();
        const now = new Date();
        await db.transaction(async (tx) => {
          await tx
            .update(usersTable)
            .set({ status: 'deleted', deletedAt: now })
            .where(eq(usersTable.id, authReq.auth!.userId));
          await tx
            .update(sessionsTable)
            .set({ revokedAt: now })
            .where(eq(sessionsTable.userId, authReq.auth!.userId));
        });

        clearSessionCookie(res);
        res.json({ ok: true, status: 'deleted' });
      } catch (err) {
        if (err instanceof OtpError) {
          sendApiError(res, err.status, err.code, err.message, {
            retryAfterSec: err.retryAfterSec,
          });
          return;
        }
        next(err);
      }
    }
  );
}
