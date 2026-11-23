const DEFAULT_MOBILE_API_BASE_URL =
  'https://ais-pre-iazskuqskw3w4j27ubtboa-25996783736.europe-west3.run.app';

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as CapacitorWindow).Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

export function getApiBaseUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_API_BASE_URL as string | undefined)
      : undefined;

  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '');
  }

  if (isCapacitorNative()) {
    return DEFAULT_MOBILE_API_BASE_URL;
  }

  return '';
}

export function isCrossOriginApi(): boolean {
  const base = getApiBaseUrl();
  if (!base || typeof window === 'undefined') return false;
  try {
    return new URL(base).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const base = getApiBaseUrl();
  if (!base) return pathOrUrl;
  return pathOrUrl.startsWith('/') ? `${base}${pathOrUrl}` : `${base}/${pathOrUrl}`;
}

export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url;
  }
  const base = getApiBaseUrl();
  if (!base) return url;
  // Local APK bundled assets under /seed or /icons stay local; uploaded media resolves against backend
  if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
    return `${base}${url}`;
  }
  return url;
}
