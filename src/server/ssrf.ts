import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import type { LookupFunction } from 'node:net';

export class SsrfError extends Error {
  status: number;
  code: string;
  constructor(message = 'الرابط غير مسموح به لأسباب أمنية') {
    super(message);
    this.name = 'SsrfError';
    this.status = 400;
    this.code = 'ssrf_blocked';
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const octet = Number(p);
    if (octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }
  return num >>> 0;
}

function inCidr4(ipInt: number, baseIp: string, prefixLen: number): boolean {
  const base = ipv4ToInt(baseIp);
  if (base === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

export function isDisallowedIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return true;
  return (
    inCidr4(ipInt, '0.0.0.0', 8) || // Unspecified / current network
    inCidr4(ipInt, '10.0.0.0', 8) || // Private RFC 1918
    inCidr4(ipInt, '100.64.0.0', 10) || // CGNAT
    inCidr4(ipInt, '127.0.0.0', 8) || // Loopback
    inCidr4(ipInt, '169.254.0.0', 16) || // Link-local & cloud metadata
    inCidr4(ipInt, '172.16.0.0', 12) || // Private RFC 1918
    inCidr4(ipInt, '192.0.0.0', 24) || // IETF protocol assignments
    inCidr4(ipInt, '192.0.2.0', 24) || // TEST-NET-1
    inCidr4(ipInt, '192.168.0.0', 16) || // Private RFC 1918
    inCidr4(ipInt, '198.18.0.0', 15) || // Benchmarking
    inCidr4(ipInt, '198.51.100.0', 24) || // TEST-NET-2
    inCidr4(ipInt, '203.0.113.0', 24) || // TEST-NET-3
    inCidr4(ipInt, '224.0.0.0', 4) || // Multicast
    inCidr4(ipInt, '240.0.0.0', 4) // Reserved / broadcast
  );
}

function expandIpv6(rawIp: string): number[] | null {
  let ip = rawIp.toLowerCase();
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);

  // Handle IPv4-embedded suffix (e.g. ::ffff:127.0.0.1)
  const lastColon = ip.lastIndexOf(':');
  if (lastColon !== -1 && ip.slice(lastColon + 1).includes('.')) {
    const v4Part = ip.slice(lastColon + 1);
    const v4Int = ipv4ToInt(v4Part);
    if (v4Int === null) return null;
    const hi = ((v4Int >>> 16) & 0xffff).toString(16);
    const lo = (v4Int & 0xffff).toString(16);
    ip = `${ip.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const groups = part.split(':');
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  if (halves.length === 2) {
    const left = parseGroups(halves[0]!);
    const right = parseGroups(halves[1]!);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    return [...left, ...new Array<number>(missing).fill(0), ...right];
  }

  const full = parseGroups(ip);
  if (!full || full.length !== 8) return null;
  return full;
}

export function isDisallowedIp(rawIp: string): boolean {
  const ip = rawIp.trim().replace(/^\[|\]$/g, '');
  if (net.isIPv4(ip)) {
    return isDisallowedIpv4(ip);
  }
  if (net.isIPv6(ip)) {
    const g = expandIpv6(ip);
    if (!g) return true;
    const allZero = g.slice(0, 7).every((x) => x === 0);
    // :: and ::1
    if (allZero && (g[7] === 0 || g[7] === 1)) return true;
    // IPv4-mapped ::ffff:0:0/96 or IPv4-compatible ::/96
    if (
      g[0] === 0 &&
      g[1] === 0 &&
      g[2] === 0 &&
      g[3] === 0 &&
      g[4] === 0 &&
      (g[5] === 0xffff || g[5] === 0)
    ) {
      const v4 = `${(g[6]! >> 8) & 0xff}.${g[6]! & 0xff}.${(g[7]! >> 8) & 0xff}.${g[7]! & 0xff}`;
      return isDisallowedIpv4(v4);
    }
    // Unique local fc00::/7
    if ((g[0]! & 0xfe00) === 0xfc00) return true;
    // Link-local fe80::/10
    if ((g[0]! & 0xffc0) === 0xfe80) return true;
    // Multicast ff00::/8
    if ((g[0]! & 0xff00) === 0xff00) return true;
    return false;
  }
  return true;
}

export async function validateExternalHttpsUrl(rawUrl: string): Promise<{
  url: URL;
  resolvedIp: string;
  family: 4 | 6;
}> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError('صيغة الرابط غير صالحة');
  }

  if (url.protocol !== 'https:') {
    throw new SsrfError('يُسمح بروابط HTTPS فقط');
  }
  if (url.username || url.password) {
    throw new SsrfError('الروابط التي تحتوي بيانات اعتماد غير مسموحة');
  }
  if (url.port && url.port !== '443') {
    throw new SsrfError('المنفذ غير مسموح به، يُسمح بالمنفذ القياسي 443 فقط');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new SsrfError('النطاقات المحلية غير مسموحة');
  }

  if (net.isIP(hostname)) {
    if (isDisallowedIp(hostname)) {
      throw new SsrfError('عناوين الشبكة الداخلية والخاصة محظورة');
    }
    return {
      url,
      resolvedIp: hostname,
      family: net.isIPv6(hostname) ? 6 : 4,
    };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfError('تعذر حل اسم النطاق');
  }

  if (!records || records.length === 0) {
    throw new SsrfError('تعذر حل اسم النطاق');
  }

  for (const rec of records) {
    if (isDisallowedIp(rec.address)) {
      throw new SsrfError('عنوان الشبكة الداخلية محظور');
    }
  }

  const first = records[0]!;
  return {
    url,
    resolvedIp: first.address,
    family: first.family === 6 ? 6 : 4,
  };
}

export async function ssrfSafeRequest(
  rawUrl: string,
  options: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxResponseBytes?: number;
  } = {}
): Promise<{ status: number; contentType: string; body: Buffer }> {
  const { url, resolvedIp, family } = await validateExternalHttpsUrl(rawUrl);
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxBytes = options.maxResponseBytes ?? 1024 * 1024;
  const method = options.method ?? 'POST';

  const pinnedLookup: LookupFunction = (_host, _opts, cb) => {
    cb(null, resolvedIp, family);
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const req = https.request(
      url,
      {
        method,
        headers: options.headers,
        timeout: timeoutMs,
        lookup: pinnedLookup,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          req.destroy();
          if (!settled) {
            settled = true;
            reject(new SsrfError('إعادة التوجيه التلقائي غير مسموحة'));
          }
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy();
            if (!settled) {
              settled = true;
              reject(new SsrfError('حجم الاستجابة يتجاوز الحد المسموح'));
            }
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (!settled) {
            settled = true;
            resolve({
              status,
              contentType: String(res.headers['content-type'] ?? ''),
              body: Buffer.concat(chunks),
            });
          }
        });
        res.on('error', (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      if (!settled) {
        settled = true;
        reject(new Error('انتهت مهلة الاتصال بالخادم الخارجي'));
      }
    });

    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}
