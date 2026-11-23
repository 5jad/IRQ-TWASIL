import type { SelfUserDto } from '../server/dto';
import type {
  AppNotification,
  ChatConversation,
  ChatMessage,
  CommunityItem,
  CommunityMessage,
  MarketOrder,
  Post,
  Product,
  SavedCollection,
  SocialMoment,
  StoryItem,
  User,
  WalletTransaction,
} from '../types';
import { inferMimeFromExtension, normalizeMediaMime, sniffMimeFromBytes } from './apiHelpers';
import { consumeBlobCropSpec } from './cropUtils';
import { resolveApiUrl } from './runtimeUrl';

export type MediaUploadKind =
  | 'post-image'
  | 'post-video'
  | 'story-image'
  | 'story-video'
  | 'avatar'
  | 'cover'
  | 'chat-image'
  | 'chat-file'
  | 'bot-avatar';

export class ApiClientError extends Error {
  status: number;
  code: string;
  retryAfterSec?: number;
  details?: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: { retryAfterSec?: number; details?: Array<{ path: string; message: string }> }
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = extra?.retryAfterSec;
    this.details = extra?.details;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SESSION_TOKEN_STORAGE_KEY = 'tw.session.token.v1';
let inMemorySessionToken: string | null = null;

export function getStoredSessionToken(): string | null {
  if (inMemorySessionToken) return inMemorySessionToken;
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = window.sessionStorage?.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (fromSession) {
      inMemorySessionToken = fromSession;
      return fromSession;
    }
  } catch {
    // Ignore sandboxed storage access errors
  }
  try {
    const fromLocal = window.localStorage?.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (fromLocal) {
      inMemorySessionToken = fromLocal;
      return fromLocal;
    }
  } catch {
    // Ignore sandboxed storage access errors
  }
  return null;
}

export function setStoredSessionToken(token: string | null | undefined): void {
  const clean = typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
  inMemorySessionToken = clean;
  if (typeof window === 'undefined') return;
  try {
    if (clean) {
      window.sessionStorage?.setItem(SESSION_TOKEN_STORAGE_KEY, clean);
    } else {
      window.sessionStorage?.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore sandboxed storage access errors
  }
  try {
    if (clean) {
      window.localStorage?.setItem(SESSION_TOKEN_STORAGE_KEY, clean);
    } else {
      window.localStorage?.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore sandboxed storage access errors
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (MUTATING_METHODS.has(method) && !headers.has('X-TW-CSRF')) {
    headers.set('X-TW-CSRF', '1');
  }

  const sessionToken = getStoredSessionToken();
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(resolveApiUrl(path), {
    ...init,
    method,
    headers,
    credentials: 'include',
  });

  const rotatedToken = res.headers.get('X-TW-Session-Token');
  if (rotatedToken) {
    setStoredSessionToken(rotatedToken);
  }

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const code = typeof parsed?.error === 'string' ? parsed.error : `http_${res.status}`;
    const message =
      typeof parsed?.message === 'string'
        ? parsed.message
        : res.status === 401
        ? 'يرجى تسجيل الدخول للمتابعة'
        : res.status === 503
        ? 'الخدمة غير متاحة مؤقتاً'
        : 'حدث خطأ في الاتصال، حاول مرة أخرى';
    const retryAfterSec =
      typeof parsed?.retryAfterSec === 'number' ? parsed.retryAfterSec : undefined;
    const details = Array.isArray(parsed?.details)
      ? (parsed.details as Array<{ path: string; message: string }>)
      : undefined;
    throw new ApiClientError(res.status, code, message, { retryAfterSec, details });
  }

  return (parsed ?? {}) as T;
}

const DIRECT_SERVER_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

async function rasterizeImageUrlToBlob(
  url: string,
  targetMime: 'image/png' | 'image/jpeg' = 'image/png',
  maxDim = 2048,
  quality = 0.88
): Promise<Blob | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth || 720;
      const natH = img.naturalHeight || 720;
      const scale = Math.min(1, maxDim / Math.max(natW, natH));
      const w = Math.max(1, Math.round(natW * scale));
      const h = Math.max(1, Math.round(natH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => resolve(b), targetMime, targetMime === 'image/jpeg' ? quality : undefined);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function getSafeMaxImageBytes(kind?: MediaUploadKind): number {
  if (kind === 'avatar' || kind === 'cover' || kind === 'bot-avatar') {
    return 4.5 * 1024 * 1024;
  }
  return 9.5 * 1024 * 1024;
}

async function normalizeResolvedBlob(
  blob: Blob,
  kind?: MediaUploadKind
): Promise<{ blob: Blob; mime: string } | null> {
  const headBuf = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const sniffed = sniffMimeFromBytes(headBuf);
  const fileName = 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined;
  const fromExt = inferMimeFromExtension(fileName);
  const declared = blob.type ? normalizeMediaMime(blob.type) : 'application/octet-stream';

  let mime = sniffed ?? (declared !== 'application/octet-stream' ? declared : fromExt ?? declared);

  if (sniffed && declared !== sniffed) {
    // Magic bytes are authoritative except MOV shares ftyp with MP4
    if (!(sniffed === 'video/mp4' && declared === 'video/quicktime')) {
      mime = sniffed;
    }
  }

  const expectsImage =
    kind === 'post-image' ||
    kind === 'story-image' ||
    kind === 'avatar' ||
    kind === 'cover' ||
    kind === 'chat-image' ||
    kind === 'bot-avatar';

  const maxSafeImageBytes =
    mime === 'image/gif'
      ? kind === 'avatar' || kind === 'cover' || kind === 'bot-avatar'
        ? 5 * 1024 * 1024
        : 10 * 1024 * 1024
      : getSafeMaxImageBytes(kind);
  const needsTranscode =
    (expectsImage || mime.startsWith('image/')) && !DIRECT_SERVER_IMAGE_MIMES.has(mime);
  const needsDownscale =
    (expectsImage || mime.startsWith('image/')) && blob.size > maxSafeImageBytes;

  if (
    (needsTranscode || needsDownscale) &&
    typeof window !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const objUrl = URL.createObjectURL(blob);
    try {
      const targetMime = needsDownscale ? 'image/jpeg' : 'image/png';
      const maxDim = kind === 'avatar' || kind === 'bot-avatar' ? 1024 : 1600;
      const convertedBlob = await rasterizeImageUrlToBlob(objUrl, targetMime, maxDim, 0.86);
      if (convertedBlob) {
        return { blob: convertedBlob, mime: targetMime };
      }
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  }

  if (mime === 'application/octet-stream') {
    mime = kind?.endsWith('-video') ? 'video/mp4' : 'image/jpeg';
  }

  return { blob, mime };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(5, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  const isBase64 = /;base64/i.test(header);
  const rawMime = header.replace(/;base64/i, '').split(';')[0]?.trim() || 'application/octet-stream';
  try {
    if (isBase64) {
      const binStr = atob(payload);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return new Blob([bytes], { type: normalizeMediaMime(rawMime) });
    }
    const decoded = decodeURIComponent(payload);
    return new Blob([decoded], { type: normalizeMediaMime(rawMime) });
  } catch {
    return null;
  }
}

export async function resolveUploadSource(
  source: File | Blob | string,
  kind?: MediaUploadKind
): Promise<{ blob: Blob; mime: string } | null> {
  if (source instanceof Blob) {
    return normalizeResolvedBlob(source, kind);
  }
  if (!source) return null;

  if (source.startsWith('/seed/') && source.endsWith('.svg')) {
    const pngBlob = await rasterizeImageUrlToBlob(source, 'image/png');
    if (!pngBlob) return null;
    return { blob: pngBlob, mime: 'image/png' };
  }

  if (source.startsWith('data:')) {
    const blob = dataUrlToBlob(source);
    if (!blob) return null;
    return normalizeResolvedBlob(blob, kind);
  }

  if (source.startsWith('blob:') || source.startsWith('/')) {
    const res = await fetch(source);
    if (!res.ok) return null;
    const blob = await res.blob();
    return normalizeResolvedBlob(blob, kind);
  }

  return null;
}

export interface UploadedMediaResult {
  mediaId: string;
  status: 'ready';
  publicUrl: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  blurhash?: string | null;
  mime: string;
}

export async function uploadMediaSource(
  source: File | Blob | string,
  kind: MediaUploadKind
): Promise<UploadedMediaResult> {
  const cropSpec = source instanceof Blob ? consumeBlobCropSpec(source) : undefined;
  const resolved = await resolveUploadSource(source, kind);
  if (!resolved) {
    throw new ApiClientError(400, 'invalid_media', 'تعذّر قراءة ملف الوسائط للرفع');
  }

  const { blob, mime } = resolved;

  const initRes = await apiFetch<{
    mediaId: string;
    uploadUrl?: string;
    url?: string;
    method: string;
    headers: Record<string, string>;
    expiresInSec: number;
  }>('/api/media/uploads', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      mime,
      sizeBytes: blob.size,
    }),
  });

  const targetUrl = initRes.uploadUrl ?? initRes.url;
  if (!targetUrl) {
    throw new ApiClientError(500, 'upload_url_missing', 'لم يتم استلام رابط الرفع من الخادم');
  }

  const putHeaders = new Headers(initRes.headers);
  if (!putHeaders.has('Content-Type')) {
    putHeaders.set('Content-Type', mime);
  }

  const putRes = await fetch(resolveApiUrl(targetUrl), {
    method: initRes.method || 'PUT',
    headers: putHeaders,
    body: blob,
  });

  if (!putRes.ok) {
    let errMsg = 'فشل رفع الملف، حاول مرة أخرى';
    try {
      const errJson = (await putRes.json()) as { message?: string };
      if (typeof errJson?.message === 'string' && errJson.message) {
        errMsg = errJson.message;
      }
    } catch {}
    throw new ApiClientError(putRes.status, 'upload_failed', errMsg);
  }

  return apiFetch<UploadedMediaResult>(
    `/api/media/uploads/${encodeURIComponent(initRes.mediaId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(cropSpec && mime === 'image/gif' ? { crop: cropSpec } : {}),
    }
  );
}

export interface BootstrapResponse {
  authenticated: boolean;
  currentUser: SelfUserDto | null;
  users: User[];
  posts: Post[];
  postsNextCursor?: string | null;
  postsHasMore?: boolean;
  conversations: ChatConversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  products: Product[];
  orders?: MarketOrder[];
  walletTransactions?: WalletTransaction[];
  savedCollections?: SavedCollection[];
  notifications: AppNotification[];
  communities: CommunityItem[];
  communityMessagesById?: Record<string, CommunityMessage[]>;
  storiesByUser: Record<string, StoryItem[]>;
  socialMoments: SocialMoment[];
}

export interface AuthDeviceDto {
  id: string;
  deviceLabel: string;
  ipAddress?: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface PublicBotDto {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  shortDescription: string;
  description: string;
  privacyMode?: boolean;
  canJoinGroups?: boolean;
  isVerified: boolean;
  commands: Array<{ command: string; description: string }>;
}

export interface AdminReportDto {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  urgent: boolean;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporterDisplayName: string | null;
  reporterHandle: string | null;
}

export interface AdminKpisDto {
  totalUsers: number;
  activeUsers24h: number;
  totalPosts: number;
  totalStories: number;
  totalBots: number;
  pendingReports: number;
  urgentReports: number;
}
