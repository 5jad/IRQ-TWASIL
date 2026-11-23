import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getApiBaseUrl,
  isCapacitorNative,
  isCrossOriginApi,
  resolveApiUrl,
  resolveMediaUrl,
} from './runtimeUrl.ts';

test('runtimeUrl defaults to same-origin relative URLs in web mode', () => {
  assert.equal(isCapacitorNative(), false);
  assert.equal(getApiBaseUrl(), '');
  assert.equal(isCrossOriginApi(), false);
  assert.equal(resolveApiUrl('/api/bootstrap'), '/api/bootstrap');
  assert.equal(resolveMediaUrl('/uploads/abc.webp'), '/uploads/abc.webp');
  assert.equal(resolveMediaUrl('/seed/baghdad.svg'), '/seed/baghdad.svg');
});

test('runtimeUrl resolves backend API and uploaded media against live backend when Capacitor native is active', () => {
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    location: { origin: 'https://localhost' },
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  };

  try {
    assert.equal(isCapacitorNative(), true);
    const base = getApiBaseUrl();
    assert.ok(base.startsWith('https://'));
    assert.equal(isCrossOriginApi(), true);
    assert.equal(resolveApiUrl('/api/posts'), `${base}/api/posts`);
    assert.equal(resolveMediaUrl('/uploads/photo.webp'), `${base}/uploads/photo.webp`);
    assert.equal(resolveMediaUrl('/seed/local.svg'), '/seed/local.svg');
    assert.equal(resolveMediaUrl('blob:https://localhost/123'), 'blob:https://localhost/123');
    assert.equal(resolveMediaUrl('https://cdn.example.com/img.png'), 'https://cdn.example.com/img.png');
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
});
