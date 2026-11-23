import test from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import { parseEnv, resetEnvCache } from './env.ts';
import { redactUrlSecrets } from './logger.ts';
import { createAppServer } from '../../server.ts';

test('parseEnv boots safely in Cloud Run production mode without explicit custom secrets by deriving runtime keys', () => {
  const env = parseEnv({
    NODE_ENV: 'production',
    PORT: '8080',
    K_SERVICE: 'irq-tawasul',
    DATABASE_URL: 'postgres://user:pass@db.example.com:5432/tawasul',
  });
  assert.equal(env.PORT, 8080);
  assert.equal(env.APP_URL, 'http://localhost:8080');
  assert.equal(env.OTP_PROVIDER, 'console');
  assert.equal(env.MEDIA_DRIVER, 'local');
  assert.equal(env.TRUST_PROXY, 1);
  assert.equal(env.USING_DERIVED_SECRETS, true);
  assert.equal(Buffer.from(env.PHONE_ENC_KEY, 'base64').length, 32);
  assert.ok(Buffer.byteLength(env.SESSION_SECRET, 'utf8') >= 32);
});

test('parseEnv strictly enforces secrets and external infra vars when STRICT_ENV=true', () => {
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: 'production',
        PORT: '3000',
        STRICT_ENV: 'true',
      }),
    (err: Error) => {
      assert.match(err.message, /APP_URL/);
      assert.match(err.message, /SESSION_SECRET/);
      assert.match(err.message, /PHONE_ENC_KEY/);
      assert.match(err.message, /PHONE_HMAC_KEY/);
      assert.match(err.message, /OTP_PEPPER/);
      assert.match(err.message, /OTP_PROVIDER/);
      assert.match(err.message, /S3_BUCKET/);
      return true;
    }
  );
});

test('parseEnv respects explicit production secrets when provided', () => {
  const env = parseEnv({
    NODE_ENV: 'production',
    PORT: '8080',
    K_SERVICE: 'irq-tawasul',
    APP_URL: 'https://tawasul.iq',
    SESSION_SECRET: 'a-strong-32-byte-production-session-secret-key',
    PHONE_ENC_KEY: Buffer.alloc(32, 7).toString('base64'),
    PHONE_HMAC_KEY: 'a-strong-production-phone-hmac-key-material',
    OTP_PEPPER: 'a-strong-production-otp-pepper-material',
  });
  assert.equal(env.PORT, 8080);
  assert.equal(env.USING_DERIVED_SECRETS, false);
  assert.equal(env.OTP_PROVIDER, 'console');
  assert.equal(env.MEDIA_DRIVER, 'local');
  assert.equal(env.TRUST_PROXY, 1);
  assert.equal(Buffer.from(env.PHONE_ENC_KEY, 'base64').length, 32);
  assert.ok(Buffer.byteLength(env.SESSION_SECRET, 'utf8') >= 32);
});

test('parseEnv falls back to console OTP and local media driver in development', () => {
  const env = parseEnv({
    NODE_ENV: 'development',
    PORT: '3000',
  });
  assert.equal(env.OTP_PROVIDER, 'console');
  assert.equal(env.MEDIA_DRIVER, 'local');
  assert.equal(Buffer.from(env.PHONE_ENC_KEY, 'base64').length, 32);
  assert.ok(Buffer.byteLength(env.SESSION_SECRET, 'utf8') >= 32);
});

test('redactUrlSecrets strips bot tokens and Iraqi phone numbers', () => {
  assert.equal(
    redactUrlSecrets('/bot12345:SECRET_TOKEN/sendMessage?phone=+9647701234567&code=123456'),
    '/bot[REDACTED]/sendMessage?phone=[PHONE]&code=[REDACTED]'
  );
});

test('server boots without DATABASE_URL, exposes health/ready/headers and enforces 100KB JSON cap', async () => {
  const prevUrl = process.env.DATABASE_URL;
  const prevNodeEnv = process.env.NODE_ENV;
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'test';
  resetEnvCache();

  const app = await createAppServer();
  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${base}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { ok: true });
    assert.equal(healthRes.headers.get('x-powered-by'), null);
    assert.ok(healthRes.headers.get('x-request-id'));
    assert.match(healthRes.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');

    const readyRes = await fetch(`${base}/api/ready`);
    assert.equal(readyRes.status, 503);
    assert.deepEqual(await readyRes.json(), { ok: false, db: false });

    const bootRes = await fetch(`${base}/api/bootstrap`);
    assert.equal(bootRes.status, 503);
    const bootJson = (await bootRes.json()) as { error: string; message: string };
    assert.equal(bootJson.error, 'service_unavailable');

    const bigPayload = JSON.stringify({ text: 'a'.repeat(120 * 1024) });
    const bigRes = await fetch(`${base}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bigPayload,
    });
    assert.equal(bigRes.status, 413);
    const bigJson = (await bigRes.json()) as { error: string };
    assert.equal(bigJson.error, 'payload_too_large');

    const capPreflight = await fetch(`${base}/api/bootstrap`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://localhost' },
    });
    assert.equal(capPreflight.status, 204);
    assert.equal(capPreflight.headers.get('access-control-allow-origin'), 'https://localhost');

    const evilPreflight = await fetch(`${base}/api/bootstrap`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(evilPreflight.status, 403);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevUrl !== undefined) process.env.DATABASE_URL = prevUrl;
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    resetEnvCache();
  }
});
