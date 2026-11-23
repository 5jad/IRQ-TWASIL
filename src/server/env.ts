import 'dotenv/config';
import crypto from 'node:crypto';
import { z } from 'zod';

export type NodeEnv = 'development' | 'test' | 'production';
export type OtpProvider = 'console' | 'generic-http';

export interface AppEnv {
  NODE_ENV: NodeEnv;
  PORT: number;
  APP_URL: string;
  DATABASE_URL?: string;
  DATABASE_CA_CERT?: string;
  SESSION_SECRET: string;
  PHONE_ENC_KEY: string;
  PHONE_HMAC_KEY: string;
  OTP_PEPPER: string;
  OTP_PROVIDER: OtpProvider;
  OTP_HTTP_URL?: string;
  OTP_HTTP_TOKEN?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  MEDIA_PUBLIC_BASE_URL?: string;
  ALLOWED_ORIGINS: string[];
  TRUST_PROXY: boolean | number;
  MEDIA_DRIVER: 's3' | 'local';
  USING_DERIVED_SECRETS: boolean;
}

function makeRuntimeFallback(
  rawEnv: Record<string, string | undefined>,
  label: string,
  bytes: number
): Buffer {
  const seedParts = [
    rawEnv.DATABASE_URL?.trim(),
    rawEnv.K_SERVICE?.trim(),
    rawEnv.GOOGLE_CLOUD_PROJECT?.trim(),
  ].filter((v): v is string => Boolean(v && v.length > 0));
  const seed = seedParts.length > 0 ? seedParts.join('|') : 'tawasul-dev-only';
  return crypto
    .createHmac('sha256', seed)
    .update(`tawasul-runtime-secret:${label}`)
    .digest()
    .subarray(0, bytes);
}

const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DATABASE_CA_CERT: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  PHONE_ENC_KEY: z.string().optional(),
  PHONE_HMAC_KEY: z.string().optional(),
  OTP_PEPPER: z.string().optional(),
  OTP_PROVIDER: z.enum(['console', 'generic-http']).optional(),
  OTP_HTTP_URL: z.string().optional(),
  OTP_HTTP_TOKEN: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
});

function nonEmpty(val: string | undefined): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidHttpUrl(val: string): boolean {
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidPostgresUrl(val: string): boolean {
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

function parseTrustProxy(raw: string | undefined): boolean | number {
  const val = nonEmpty(raw);
  if (!val || val === 'false' || val === '0') return false;
  if (val === 'true') return true;
  const num = Number(val);
  if (Number.isInteger(num) && num >= 0 && num <= 10) return num;
  return false;
}

export interface ParseEnvOptions {
  strictProduction?: boolean;
}

export function parseEnv(
  rawEnv: Record<string, string | undefined> = process.env,
  options: ParseEnvOptions = {}
): AppEnv {
  const parsed = BaseEnvSchema.safeParse(rawEnv);
  const errors: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.') || 'env'}: ${issue.message}`);
    }
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }

  const raw = parsed.data;
  const isProd = raw.NODE_ENV === 'production';
  const strictMode = options.strictProduction === true || (isProd && nonEmpty(rawEnv.STRICT_ENV) === 'true');
  const strictSecrets = strictMode;
  const strictExternalInfra = strictMode;

  const appUrlRaw = nonEmpty(raw.APP_URL);
  const appUrl =
    appUrlRaw && appUrlRaw !== 'MY_APP_URL'
      ? appUrlRaw
      : strictSecrets
      ? undefined
      : `http://localhost:${raw.PORT}`;

  if (!appUrl) {
    errors.push('APP_URL is required in production');
  } else if (!isValidHttpUrl(appUrl)) {
    errors.push('APP_URL must be a valid http or https URL');
  }

  const databaseUrl = nonEmpty(raw.DATABASE_URL);
  if (databaseUrl && !isValidPostgresUrl(databaseUrl)) {
    errors.push('DATABASE_URL must be a valid postgres:// or postgresql:// URL');
  }

  const caCertRaw = nonEmpty(raw.DATABASE_CA_CERT);
  const caCert = caCertRaw ? caCertRaw.replace(/\\n/g, '\n') : undefined;

  let usingDerivedSecrets = false;

  let sessionSecret = nonEmpty(raw.SESSION_SECRET);
  if (strictSecrets && !sessionSecret) {
    errors.push('SESSION_SECRET is required in production (at least 32 bytes)');
  } else if (sessionSecret && Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    errors.push('SESSION_SECRET must be at least 32 bytes');
  } else if (!sessionSecret) {
    usingDerivedSecrets = true;
    sessionSecret = makeRuntimeFallback(rawEnv, 'session-secret', 32).toString('hex');
  }

  let phoneEncKey = nonEmpty(raw.PHONE_ENC_KEY);
  if (strictSecrets && !phoneEncKey) {
    errors.push('PHONE_ENC_KEY is required in production (32-byte base64 key)');
  } else if (phoneEncKey) {
    const decoded = Buffer.from(phoneEncKey, 'base64');
    if (decoded.length !== 32) {
      errors.push('PHONE_ENC_KEY must decode from base64 to exactly 32 bytes');
    }
  } else {
    usingDerivedSecrets = true;
    phoneEncKey = makeRuntimeFallback(rawEnv, 'phone-enc-key', 32).toString('base64');
  }

  let phoneHmacKey = nonEmpty(raw.PHONE_HMAC_KEY);
  if (strictSecrets && !phoneHmacKey) {
    errors.push('PHONE_HMAC_KEY is required in production');
  } else if (!phoneHmacKey) {
    usingDerivedSecrets = true;
    phoneHmacKey = makeRuntimeFallback(rawEnv, 'phone-hmac-key', 32).toString('hex');
  }

  let otpPepper = nonEmpty(raw.OTP_PEPPER);
  if (strictSecrets && !otpPepper) {
    errors.push('OTP_PEPPER is required in production');
  } else if (!otpPepper) {
    usingDerivedSecrets = true;
    otpPepper = makeRuntimeFallback(rawEnv, 'otp-pepper', 32).toString('hex');
  }

  const otpProvider: OtpProvider = raw.OTP_PROVIDER ?? 'console';
  if (strictExternalInfra && isProd && !raw.OTP_PROVIDER) {
    errors.push('OTP_PROVIDER is required in production (console or generic-http)');
  }

  const otpHttpUrl = nonEmpty(raw.OTP_HTTP_URL);
  const otpHttpToken = nonEmpty(raw.OTP_HTTP_TOKEN);
  if (otpProvider === 'generic-http') {
    if (!otpHttpUrl || !isValidHttpUrl(otpHttpUrl)) {
      errors.push('OTP_HTTP_URL must be a valid URL when OTP_PROVIDER=generic-http');
    }
    if (!otpHttpToken) {
      errors.push('OTP_HTTP_TOKEN is required when OTP_PROVIDER=generic-http');
    }
  }

  const s3Endpoint = nonEmpty(raw.S3_ENDPOINT);
  const s3Region = nonEmpty(raw.S3_REGION);
  const s3Bucket = nonEmpty(raw.S3_BUCKET);
  const s3AccessKeyId = nonEmpty(raw.S3_ACCESS_KEY_ID);
  const s3SecretAccessKey = nonEmpty(raw.S3_SECRET_ACCESS_KEY);
  const mediaPublicBaseUrl = nonEmpty(raw.MEDIA_PUBLIC_BASE_URL);

  const hasAnyS3 = Boolean(
    s3Endpoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey || mediaPublicBaseUrl
  );
  const hasFullS3 = Boolean(
    s3Endpoint && s3Region && s3Bucket && s3AccessKeyId && s3SecretAccessKey && mediaPublicBaseUrl
  );

  if ((strictExternalInfra && isProd) || hasAnyS3) {
    if (!s3Endpoint || !isValidHttpUrl(s3Endpoint)) errors.push('S3_ENDPOINT is required and must be a valid URL');
    if (!s3Region) errors.push('S3_REGION is required');
    if (!s3Bucket) errors.push('S3_BUCKET is required');
    if (!s3AccessKeyId) errors.push('S3_ACCESS_KEY_ID is required');
    if (!s3SecretAccessKey) errors.push('S3_SECRET_ACCESS_KEY is required');
    if (!mediaPublicBaseUrl || !isValidHttpUrl(mediaPublicBaseUrl)) {
      errors.push('MEDIA_PUBLIC_BASE_URL is required and must be a valid URL');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }

  const allowedOrigins = (nonEmpty(raw.ALLOWED_ORIGINS) ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  const trustProxy =
    nonEmpty(raw.TRUST_PROXY) !== undefined
      ? parseTrustProxy(raw.TRUST_PROXY)
      : nonEmpty(rawEnv.K_SERVICE)
      ? 1
      : false;

  return {
    NODE_ENV: raw.NODE_ENV,
    PORT: raw.PORT,
    APP_URL: appUrl!,
    DATABASE_URL: databaseUrl,
    DATABASE_CA_CERT: caCert,
    SESSION_SECRET: sessionSecret!,
    PHONE_ENC_KEY: phoneEncKey!,
    PHONE_HMAC_KEY: phoneHmacKey!,
    OTP_PEPPER: otpPepper!,
    OTP_PROVIDER: otpProvider,
    OTP_HTTP_URL: otpHttpUrl,
    OTP_HTTP_TOKEN: otpHttpToken,
    S3_ENDPOINT: s3Endpoint,
    S3_REGION: s3Region,
    S3_BUCKET: s3Bucket,
    S3_ACCESS_KEY_ID: s3AccessKeyId,
    S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
    MEDIA_PUBLIC_BASE_URL: mediaPublicBaseUrl,
    ALLOWED_ORIGINS: allowedOrigins,
    TRUST_PROXY: trustProxy,
    MEDIA_DRIVER: hasFullS3 ? 's3' : 'local',
    USING_DERIVED_SECRETS: usingDerivedSecrets,
  };
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
