import crypto from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { getEnv } from './env.ts';

const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'tawasul',
  'twasil',
  'system',
  'root',
  'moderator',
  'mod',
  'security',
  'official',
  'bot',
  'botfactory',
  'botfactory_bot',
  'api',
  'auth',
  'me',
  'settings',
  'staff',
  'null',
  'undefined',
]);

export function normalizeDigitsToAscii(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizePhoneToE164(rawInput: string): string {
  const ascii = normalizeDigitsToAscii(rawInput).trim();
  const stripped = ascii.replace(/[\s\-().]/g, '');

  let candidate = stripped;
  if (candidate.startsWith('00')) {
    candidate = `+${candidate.slice(2)}`;
  } else if (/^07\d{9}$/.test(candidate)) {
    candidate = `+964${candidate.slice(1)}`;
  } else if (/^7\d{9}$/.test(candidate)) {
    candidate = `+964${candidate}`;
  } else if (/^9647\d{9}$/.test(candidate)) {
    candidate = `+${candidate}`;
  }

  const parsed = parsePhoneNumberFromString(candidate, 'IQ');
  if (!parsed || !parsed.isValid()) {
    throw new Error('رقم الهاتف غير صالح');
  }

  const phoneType = parsed.getType();
  if (phoneType === 'VOIP') {
    throw new Error('رقم الهاتف غير صالح');
  }

  return parsed.number;
}

export function encryptPhone(e164: string): string {
  const env = getEnv();
  const key = Buffer.from(env.PHONE_ENC_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptPhone(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split('.');
  if (parts.length !== 3) return null;
  try {
    const env = getEnv();
    const key = Buffer.from(env.PHONE_ENC_KEY, 'base64');
    const iv = Buffer.from(parts[0]!, 'base64');
    const tag = Buffer.from(parts[1]!, 'base64');
    const data = Buffer.from(parts[2]!, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function hmacPhone(e164: string): string {
  const env = getEnv();
  return crypto.createHmac('sha256', env.PHONE_HMAC_KEY).update(e164).digest('hex');
}

export function validateHandle(
  rawHandle: string,
  options?: { isBot?: boolean }
): { ok: true; handle: string } | { ok: false; message: string } {
  const handle = normalizeDigitsToAscii(rawHandle).trim().toLowerCase();
  if (handle.length < 3 || handle.length > 20) {
    return { ok: false, message: 'اسم المستخدم يجب أن يكون بين ٣ و ٢٠ حرفاً' };
  }
  if (!/^[a-z0-9_.]+$/.test(handle)) {
    return { ok: false, message: 'يُسمح فقط بالأحرف الإنكليزية والأرقام و _ و .' };
  }
  if (handle.startsWith('.') || handle.endsWith('.') || handle.includes('..')) {
    return { ok: false, message: 'لا يمكن أن يبدأ اسم المستخدم أو ينتهي بنقطة أو يحتوي نقطتين متتاليتين' };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, message: 'اسم المستخدم هذا محجوز للنظام' };
  }
  if (options?.isBot) {
    if (!handle.endsWith('_bot') || handle.length < 5) {
      return { ok: false, message: 'يجب أن ينتهي اسم البوت بـ _bot' };
    }
  } else if (handle.endsWith('_bot')) {
    return { ok: false, message: 'اللاحقة _bot مخصصة لحسابات البوتات فقط' };
  }
  return { ok: true, handle };
}
