import type { ChatConversation, ChatMessage } from '../types';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const idx1 = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (idx1 !== -1) {
      out += String(idx1);
      continue;
    }
    const idx2 = EXT_ARABIC_INDIC_DIGITS.indexOf(ch);
    if (idx2 !== -1) {
      out += String(idx2);
      continue;
    }
    out += ch;
  }
  return out;
}

export function normalizeOtpDigits(input: string): string {
  return normalizeDigits(input).replace(/\D/g, '').slice(0, 6);
}

export function isValidIraqiPhoneInput(raw: string): boolean {
  const cleaned = normalizeDigits(raw).replace(/[\s\-()]/g, '');
  if (!cleaned) return false;
  // Accepts 07XXXXXXXXX (11 digits), 7XXXXXXXXX (10 digits), +9647XXXXXXXXX, or 009647XXXXXXXXX
  return /^(?:\+?964|00964|0)?7[3-9]\d{8}$/.test(cleaned);
}

const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'root',
  'support',
  'help',
  'tawasul',
  'twasil',
  'mod',
  'moderator',
  'system',
  'official',
  'security',
  'bot',
  'bots',
  'botfactory',
  'botfactory_bot',
]);

export function validateClientHandle(raw: string): { ok: boolean; handle: string; message?: string } {
  const handle = raw.trim().replace(/^@+/, '').toLowerCase();
  if (handle.length < 3 || handle.length > 20) {
    return {
      ok: false,
      handle,
      message: 'اسم المستخدم يجب أن يكون بين ٣ و٢٠ حرفاً',
    };
  }
  if (!/^[a-z0-9_.]+$/.test(handle)) {
    return {
      ok: false,
      handle,
      message: 'يُسمح فقط بالأحرف الإنجليزية الصغيرة والأرقام و _ و .',
    };
  }
  if (handle.startsWith('.') || handle.endsWith('.') || handle.includes('..')) {
    return {
      ok: false,
      handle,
      message: 'لا يمكن أن يبدأ أو ينتهي اسم المستخدم بنقطة',
    };
  }
  if (RESERVED_HANDLES.has(handle) || handle.endsWith('_bot') || handle.endsWith('bot')) {
    return {
      ok: false,
      handle,
      message: 'اسم المستخدم هذا محجوز للنظام أو البوتات',
    };
  }
  return { ok: true, handle };
}

export function normalizeMediaMime(rawMime: string): string {
  const base = rawMime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'image/jpg' || base === 'image/pjpeg') return 'image/jpeg';
  if (base === 'audio/mp3') return 'audio/mpeg';
  if (base === 'video/x-m4v') return 'video/mp4';
  if (base === 'video/x-matroska') return 'video/webm';
  return base || 'application/octet-stream';
}

export function inferMimeFromExtension(filename?: string | null): string | null {
  if (!filename) return null;
  const clean = filename.split('?')[0]?.split('#')[0]?.trim().toLowerCase() ?? '';
  const dot = clean.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = clean.slice(dot + 1);
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'jfif':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
    case 'mkv':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'pdf':
      return 'application/pdf';
    case 'zip':
      return 'application/zip';
    case 'txt':
      return 'text/plain';
    default:
      return null;
  }
}

export function sniffMimeFromBytes(head: Uint8Array): string | null {
  if (head.length < 4) return null;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (
    head.length >= 6 &&
    head[0] === 0x47 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x38 &&
    (head[4] === 0x37 || head[4] === 0x39) &&
    head[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    head.length >= 12 &&
    head[4] === 0x66 &&
    head[5] === 0x74 &&
    head[6] === 0x79 &&
    head[7] === 0x70
  ) {
    const brand = String.fromCharCode(head[8] ?? 0, head[9] ?? 0, head[10] ?? 0, head[11] ?? 0);
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return 'video/webm';
  }
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    return 'application/pdf';
  }
  if (head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05)) {
    return 'application/zip';
  }
  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
    return 'audio/ogg';
  }
  return null;
}

export function isVideoSource(source: File | Blob | string): boolean {
  if (typeof source === 'string') {
    const trimmed = source.trim().toLowerCase();
    if (trimmed.startsWith('data:video/')) return true;
    const extMime = inferMimeFromExtension(trimmed);
    return Boolean(extMime && extMime.startsWith('video/'));
  }
  const typeMime = source.type ? normalizeMediaMime(source.type) : '';
  if (typeMime.startsWith('video/')) return true;
  const fileName = 'name' in source && typeof source.name === 'string' ? source.name : undefined;
  const extMime = inferMimeFromExtension(fileName);
  return Boolean(extMime && extMime.startsWith('video/'));
}

export function inferChatMediaKind(mime: string): 'image' | 'file' {
  const norm = normalizeMediaMime(mime);
  if (norm === 'image/jpeg' || norm === 'image/png' || norm === 'image/webp' || norm === 'image/gif') {
    return 'image';
  }
  return 'file';
}

export function mergeIncomingMessage(existing: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = existing.findIndex((m) => m.id === incoming.id);
  if (idx !== -1) {
    const next = [...existing];
    next[idx] = { ...existing[idx]!, ...incoming };
    return next;
  }
  return [...existing, incoming];
}

export function applyDeltaConversationUnreads(
  conversations: ChatConversation[],
  unreadById: Record<string, number>
): ChatConversation[] {
  let changed = false;
  const next = conversations.map((c) => {
    if (Object.prototype.hasOwnProperty.call(unreadById, c.id)) {
      const serverUnread = unreadById[c.id]!;
      if (serverUnread !== c.unreadCount) {
        changed = true;
        return { ...c, unreadCount: serverUnread };
      }
    }
    return c;
  });
  return changed ? next : conversations;
}
